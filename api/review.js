import { neon } from "@neondatabase/serverless";
import { Resend } from "resend";

const MAX_NOTE_LENGTH = 4000;
const MAX_EMAIL_LENGTH = 20000;
const EMAIL_FROM = "Justin · Blueprint WebStudio <hello@blueprintwebstudio.com>";
const STUDIO_INBOX = "hello@blueprintwebstudio.com";
const EMAIL_PATTERN = /^[^\s@<>,;]+@[^\s@<>,;]+\.[a-z]{2,}$/i;

// Bracketed lowercase phrases like "[studio mailing address]" are draft
// placeholders. Uppercase tokens like "[GEOTITLE]" are quoted from client sites.
const PLACEHOLDER_PATTERN = /\[(?:[a-z]+ )+[a-z]+\]/;

function fail(res, status, message) {
  return res.status(status).json({ success: false, message });
}

function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Turns the plain-text draft (with **bold**, _italic_, links and "- " lists)
// into simple HTML for mail clients; the plain text goes along as well.
function emailHtml(text) {
  const inline = (line) =>
    escapeHtml(line)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|\s)_(.+?)_(?=\s|$)/g, "$1<em>$2</em>")
      .replace(
        /(https?:\/\/[^\s<]+[^\s<.,)])/g,
        '<a href="$1" style="color:#0869e8">$1</a>'
      );

  const blocks = text.trim().split(/\n{2,}/).map((block) => {
    const lines = block.split("\n");

    if (lines.every((line) => /^- /.test(line))) {
      return `<ul>${lines.map((line) => `<li>${inline(line.slice(2))}</li>`).join("")}</ul>`;
    }
    if (lines.every((line) => /^\d+\. /.test(line))) {
      return `<ol>${lines.map((line) => `<li>${inline(line.replace(/^\d+\. /, ""))}</li>`).join("")}</ol>`;
    }
    return `<p>${lines.map(inline).join("<br>")}</p>`;
  });

  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:#09192f;max-width:600px">${blocks.join("")}</div>`;
}

function plainText(text) {
  return text.replace(/\*\*(.+?)\*\*/g, "$1").replace(/(^|\s)_(.+?)_(?=\s|$)/g, "$1$2");
}

function toId(value) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

async function loadDemos(sql) {
  // Every client demo, newest first. Viewing this list does not count as a
  // client view, so view_count stays a true measure of client interest.
  const demos = await sql`
    SELECT
      id,
      business_name,
      demo_code,
      demo_url,
      status,
      original_url,
      category,
      city,
      background,
      created_at,
      first_viewed_at,
      last_viewed_at,
      view_count,
      ready_to_email,
      ready_at,
      contact_name,
      contact_email,
      phone,
      address,
      email_subject,
      email_body,
      emailed_at,
      emailed_to
    FROM demos
    WHERE is_admin = false
    ORDER BY created_at DESC, id DESC
  `;

  const notes = await sql`
    SELECT n.id, n.demo_id, n.body, n.created_at, n.resolved_at, n.resolution
    FROM demo_notes n
    JOIN demos d ON d.id = n.demo_id
    WHERE d.is_admin = false
    ORDER BY n.created_at ASC, n.id ASC
  `;

  const notesByDemo = new Map();
  for (const note of notes) {
    const key = String(note.demo_id);
    if (!notesByDemo.has(key)) notesByDemo.set(key, []);
    notesByDemo.get(key).push(note);
  }

  return demos.map((demo) => ({
    ...demo,
    notes: notesByDemo.get(String(demo.id)) ?? [],
  }));
}

export default async function handler(req, res) {
  // Never cache this response; it is only for the studio owner
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");

  // Only allow POST requests
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return fail(res, 405, "Method not allowed.");
  }

  try {
    const {
      code,
      action = "list",
      demoId,
      noteId,
      body,
      ready,
      resolved,
      to,
      subject,
      sendAgain,
    } = req.body ?? {};

    // Make sure a review code was provided
    if (!code || typeof code !== "string" || !code.trim()) {
      return fail(res, 400, "Please enter your review code.");
    }

    // Normalize the code so capitalization doesn't matter
    const normalizedCode = code.trim().toUpperCase();

    // Get the Neon connection string from Vercel
    const connectionString = process.env.BLUEPRINT_DB_DATABASE_URL;

    if (!connectionString) {
      console.error("Missing BLUEPRINT_DB_DATABASE_URL environment variable.");
      return fail(res, 500, "The review page is temporarily unavailable.");
    }

    // Connect to Neon
    const sql = neon(connectionString);

    // The review code is an active row in demos flagged as an admin code
    const access = await sql`
      SELECT id
      FROM demos
      WHERE UPPER(demo_code) = ${normalizedCode}
        AND status = 'active'
        AND is_admin = true
      LIMIT 1
    `;

    if (access.length === 0) {
      return fail(res, 401, "That review code isn't valid.");
    }

    if (action === "addNote") {
      const id = toId(demoId);
      const text = typeof body === "string" ? body.trim() : "";

      if (!id || !text) return fail(res, 400, "Write a note first.");
      if (text.length > MAX_NOTE_LENGTH) {
        return fail(res, 400, "That note is too long.");
      }

      const added = await sql`
        INSERT INTO demo_notes (demo_id, body)
        SELECT id, ${text} FROM demos WHERE id = ${id} AND is_admin = false
        RETURNING id
      `;
      if (added.length === 0) return fail(res, 404, "Concept not found.");
    } else if (action === "setNoteResolved") {
      const id = toId(noteId);
      if (!id) return fail(res, 400, "Note not found.");

      // Reopening a note clears any resolution text left on it
      if (resolved) {
        await sql`
          UPDATE demo_notes
          SET resolved_at = COALESCE(resolved_at, NOW())
          WHERE id = ${id}
        `;
      } else {
        await sql`
          UPDATE demo_notes
          SET resolved_at = NULL, resolution = NULL
          WHERE id = ${id}
        `;
      }
    } else if (action === "deleteNote") {
      const id = toId(noteId);
      if (!id) return fail(res, 400, "Note not found.");

      await sql`DELETE FROM demo_notes WHERE id = ${id}`;
    } else if (action === "setReady") {
      // Only records the decision; no email is sent from here
      const id = toId(demoId);
      if (!id) return fail(res, 400, "Concept not found.");

      await sql`
        UPDATE demos
        SET
          ready_to_email = ${Boolean(ready)},
          ready_at = CASE WHEN ${Boolean(ready)} THEN NOW() ELSE NULL END
        WHERE id = ${id} AND is_admin = false
      `;
    } else if (action === "saveEmail") {
      // Saves the recipient and the draft without sending anything
      const id = toId(demoId);
      if (!id) return fail(res, 400, "Concept not found.");

      const recipient = typeof to === "string" ? to.trim() : "";
      if (recipient && !EMAIL_PATTERN.test(recipient)) {
        return fail(res, 400, "That email address doesn't look right.");
      }
      if (typeof body === "string" && body.length > MAX_EMAIL_LENGTH) {
        return fail(res, 400, "That email is too long.");
      }

      await sql`
        UPDATE demos
        SET
          contact_email = ${recipient || null},
          email_subject = ${typeof subject === "string" ? subject.trim() : null},
          email_body = ${typeof body === "string" ? body : null}
        WHERE id = ${id} AND is_admin = false
      `;
    } else if (action === "sendEmail") {
      const id = toId(demoId);
      if (!id) return fail(res, 400, "Concept not found.");

      const rows = await sql`
        SELECT id, contact_email, email_subject, email_body, ready_to_email, emailed_at
        FROM demos
        WHERE id = ${id} AND is_admin = false
      `;
      const demo = rows[0];
      if (!demo) return fail(res, 404, "Concept not found.");

      // The page saves the draft first, so the stored copy is what gets sent
      const recipient = (demo.contact_email || "").trim();
      const emailSubject = (demo.email_subject || "").trim();
      const emailBody = (demo.email_body || "").trim();

      if (!demo.ready_to_email) {
        return fail(res, 400, "Check \"Ready to email the client\" first.");
      }
      if (!EMAIL_PATTERN.test(recipient)) {
        return fail(res, 400, "Add the client's email address first.");
      }
      if (!emailSubject || !emailBody) {
        return fail(res, 400, "The email needs a subject and a message.");
      }
      const placeholder = emailBody.match(PLACEHOLDER_PATTERN);
      if (placeholder) {
        return fail(res, 400, `Replace ${placeholder[0]} in the email before sending.`);
      }
      if (demo.emailed_at && !sendAgain) {
        return fail(res, 409, "This client was already emailed.");
      }
      if (!process.env.RESEND_API_KEY) {
        console.error("Missing RESEND_API_KEY environment variable.");
        return fail(res, 500, "Email sending isn't set up right now.");
      }

      const resend = new Resend(process.env.RESEND_API_KEY);
      const { data, error } = await resend.emails.send({
        from: EMAIL_FROM,
        to: [recipient],
        bcc: [STUDIO_INBOX],
        replyTo: STUDIO_INBOX,
        subject: emailSubject,
        text: plainText(emailBody),
        html: emailHtml(emailBody),
      });

      if (error) {
        console.error("Resend error:", error);
        return fail(res, 502, "The email didn't send. Please try again.");
      }

      await sql`
        UPDATE demos
        SET emailed_at = NOW(), emailed_to = ${recipient}, email_message_id = ${data?.id ?? null}
        WHERE id = ${id}
      `;
    } else if (action !== "list") {
      return fail(res, 400, "Unknown action.");
    }

    return res.status(200).json({
      success: true,
      demos: await loadDemos(sql),
    });
  } catch (error) {
    console.error("Review lookup error:", error);
    return fail(
      res,
      500,
      "We couldn't load the review page right now. Please try again."
    );
  }
}
