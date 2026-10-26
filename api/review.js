import { neon } from "@neondatabase/serverless";
import { Resend } from "resend";

const MAX_NOTE_LENGTH = 4000;
const MAX_EMAIL_LENGTH = 20000;
const EMAIL_FROM = "Justin · Blueprint WebStudio <hello@blueprintwebstudio.com>";
const STUDIO_INBOX = "hello@blueprintwebstudio.com";
const EMAIL_PATTERN = /^[^\s@<>,;]+@[^\s@<>,;]+\.[a-z]{2,}$/i;
const CONTACT_METHODS = ["email", "phone", "form"];
const REQUEST_STATUSES = ["new", "in_progress", "done", "declined"];
const INVOICE_STATUSES = ["draft", "open", "paid", "void"];
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

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
      emailed_to,
      contact_form_url,
      portal_enabled
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

  // Every way each business has been reached, oldest first
  const contacts = await sql`
    SELECT c.id, c.demo_id, c.method, c.contacted_at, c.note
    FROM demo_contacts c
    JOIN demos d ON d.id = c.demo_id
    WHERE d.is_admin = false
    ORDER BY c.contacted_at ASC NULLS FIRST, c.id ASC
  `;

  // Client portal: accounts, change requests and invoices per site
  const accounts = await sql`
    SELECT id, demo_id, name, email, created_at, last_login_at
    FROM client_accounts
    WHERE disabled_at IS NULL
    ORDER BY created_at ASC
  `;

  const requests = await sql`
    SELECT r.id, r.demo_id, r.page, r.body, r.priority, r.status, r.studio_reply,
           r.created_at, r.completed_at, a.name AS author
    FROM change_requests r
    LEFT JOIN client_accounts a ON a.id = r.account_id
    ORDER BY r.created_at DESC, r.id DESC
  `;

  const invoices = await sql`
    SELECT id, demo_id, number, description, amount_cents, status,
           issued_on, due_on, paid_on, payment_url
    FROM invoices
    ORDER BY issued_on DESC, id DESC
  `;

  const groupByDemo = (rows) => {
    const grouped = new Map();
    for (const row of rows) {
      const key = String(row.demo_id);
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(row);
    }
    return grouped;
  };
  const notesByDemo = groupByDemo(notes);
  const contactsByDemo = groupByDemo(contacts);
  const accountsByDemo = groupByDemo(accounts);
  const requestsByDemo = groupByDemo(requests);
  const invoicesByDemo = groupByDemo(invoices);

  return demos.map((demo) => ({
    ...demo,
    notes: notesByDemo.get(String(demo.id)) ?? [],
    contacts: contactsByDemo.get(String(demo.id)) ?? [],
    accounts: accountsByDemo.get(String(demo.id)) ?? [],
    requests: requestsByDemo.get(String(demo.id)) ?? [],
    invoices: invoicesByDemo.get(String(demo.id)) ?? [],
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
      contactId,
      method,
      formUrl,
      to,
      subject,
      sendAgain,
      enabled,
      requestId,
      status,
      reply,
      invoiceId,
      invoice,
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
    } else if (action === "logContact") {
      // Records an outreach attempt made outside the page (a call, a form)
      const id = toId(demoId);
      if (!id) return fail(res, 400, "Concept not found.");
      if (!CONTACT_METHODS.includes(method)) {
        return fail(res, 400, "Pick how you reached them.");
      }
      const text = typeof body === "string" ? body.trim().slice(0, 500) : "";

      const added = await sql`
        INSERT INTO demo_contacts (demo_id, method, contacted_at, note)
        SELECT id, ${method}, NOW(), ${text || null}
        FROM demos WHERE id = ${id} AND is_admin = false
        RETURNING id
      `;
      if (added.length === 0) return fail(res, 404, "Concept not found.");
    } else if (action === "deleteContact") {
      const id = toId(contactId);
      if (!id) return fail(res, 400, "Entry not found.");

      await sql`DELETE FROM demo_contacts WHERE id = ${id}`;
    } else if (action === "saveFormUrl") {
      const id = toId(demoId);
      if (!id) return fail(res, 400, "Concept not found.");
      const url = typeof formUrl === "string" ? formUrl.trim() : "";
      if (url && !/^https?:\/\/\S+$/i.test(url)) {
        return fail(res, 400, "That link should start with https://");
      }

      await sql`
        UPDATE demos SET contact_form_url = ${url || null}
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
      await sql`
        INSERT INTO demo_contacts (demo_id, method, contacted_at, note)
        VALUES (${id}, 'email', NOW(), ${`Sent from the review page to ${recipient}`})
      `;
    } else if (action === "setPortal") {
      // Lets this client create an account with their access code
      const id = toId(demoId);
      if (!id) return fail(res, 400, "Concept not found.");

      await sql`
        UPDATE demos SET portal_enabled = ${Boolean(enabled)}
        WHERE id = ${id} AND is_admin = false
      `;
    } else if (action === "updateRequest") {
      const id = toId(requestId);
      if (!id) return fail(res, 400, "Request not found.");
      if (!REQUEST_STATUSES.includes(status)) return fail(res, 400, "Pick a status.");
      const replyText = typeof reply === "string" ? reply.trim().slice(0, 2000) : "";

      await sql`
        UPDATE change_requests
        SET
          status = ${status},
          studio_reply = ${replyText || null},
          updated_at = NOW(),
          picked_up_at = CASE WHEN ${status} = 'new' THEN NULL ELSE COALESCE(picked_up_at, NOW()) END,
          completed_at = CASE WHEN ${status} IN ('done', 'declined') THEN COALESCE(completed_at, NOW()) ELSE NULL END
        WHERE id = ${id}
      `;
    } else if (action === "addInvoice") {
      const id = toId(demoId);
      if (!id) return fail(res, 400, "Concept not found.");

      const number = String(invoice?.number ?? "").trim().slice(0, 40);
      const description = String(invoice?.description ?? "").trim().slice(0, 200);
      const amount = Math.round(Number(invoice?.amount) * 100);
      const invoiceStatus = INVOICE_STATUSES.includes(invoice?.status) ? invoice.status : "open";
      const issuedOn = DATE_PATTERN.test(invoice?.issuedOn ?? "") ? invoice.issuedOn : null;
      const dueOn = DATE_PATTERN.test(invoice?.dueOn ?? "") ? invoice.dueOn : null;
      const paymentUrl = String(invoice?.paymentUrl ?? "").trim();

      if (!number || !description) return fail(res, 400, "Add an invoice number and description.");
      if (!Number.isSafeInteger(amount) || amount < 0) return fail(res, 400, "Enter the amount in dollars.");
      if (paymentUrl && !/^https:\/\/\S+$/i.test(paymentUrl)) {
        return fail(res, 400, "The payment link should start with https://");
      }

      await sql`
        INSERT INTO invoices (demo_id, number, description, amount_cents, status, issued_on, due_on, paid_on, payment_url)
        VALUES (
          ${id}, ${number}, ${description}, ${amount}, ${invoiceStatus},
          COALESCE(${issuedOn}::date, CURRENT_DATE), ${dueOn}::date,
          CASE WHEN ${invoiceStatus} = 'paid' THEN CURRENT_DATE END,
          ${paymentUrl || null}
        )
      `;
    } else if (action === "setInvoiceStatus") {
      const id = toId(invoiceId);
      if (!id) return fail(res, 400, "Invoice not found.");
      if (!INVOICE_STATUSES.includes(status)) return fail(res, 400, "Pick a status.");

      await sql`
        UPDATE invoices
        SET
          status = ${status},
          paid_on = CASE WHEN ${status} = 'paid' THEN COALESCE(paid_on, CURRENT_DATE) ELSE NULL END
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
