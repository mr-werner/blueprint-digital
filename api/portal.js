import { randomBytes } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { Resend } from "resend";
import {
  checkPassword,
  clearedCookie,
  currentAccount,
  endSession,
  hashPassword,
  hashToken,
  startSession,
} from "../lib/portal-auth.js";

const EMAIL_PATTERN = /^[^\s@<>,;]+@[^\s@<>,;]+\.[a-z]{2,}$/i;
const MIN_PASSWORD = 8;
const MAX_REQUEST_LENGTH = 4000;
const PRIORITIES = ["low", "normal", "high"];
const STUDIO_INBOX = "hello@blueprintwebstudio.com";
const NOTIFY_FROM = "Blueprint WebStudio Portal <hello@blueprintwebstudio.com>";
const STATS_DAYS = 30;
const RESET_MINUTES = 60;
const RESET_SENT =
  "If that email has a client portal account, a reset link is on its way. It works for one hour.";

function fail(res, status, message) {
  return res.status(status).json({ success: false, message });
}

function text(value, max = 200) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

// Everything the dashboard shows for one site
async function loadDashboard(sql, account) {
  const [site] = await sql`
    SELECT id, business_name, contact_name, demo_url, created_at, view_count, last_viewed_at
    FROM demos WHERE id = ${account.demo_id}
  `;

  const daily = await sql`
    SELECT
      to_char(day, 'YYYY-MM-DD') AS day,
      COUNT(v.id)::int AS visits,
      COUNT(DISTINCT v.visitor)::int AS visitors
    FROM generate_series(
      (NOW() AT TIME ZONE 'America/Denver')::date - ${STATS_DAYS - 1}::int,
      (NOW() AT TIME ZONE 'America/Denver')::date,
      interval '1 day'
    ) AS day
    LEFT JOIN site_visits v
      ON v.demo_id = ${site.id}
      AND (v.visited_at AT TIME ZONE 'America/Denver')::date = day::date
    GROUP BY day
    ORDER BY day
  `;

  const [totals] = await sql`
    SELECT
      COUNT(*)::int AS visits,
      COUNT(DISTINCT visitor)::int AS visitors,
      COUNT(*) FILTER (WHERE device = 'mobile')::int AS mobile,
      MAX(visited_at) AS last_visit
    FROM site_visits
    WHERE demo_id = ${site.id}
      AND visited_at > NOW() - make_interval(days => ${STATS_DAYS})
  `;

  const referrers = await sql`
    SELECT COALESCE(NULLIF(referrer, ''), 'Direct') AS source, COUNT(*)::int AS visits
    FROM site_visits
    WHERE demo_id = ${site.id}
      AND visited_at > NOW() - make_interval(days => ${STATS_DAYS})
    GROUP BY 1
    ORDER BY 2 DESC
    LIMIT 5
  `;

  // Drafts stay private to the studio until they're issued
  const invoices = await sql`
    SELECT id, number, description, amount_cents, status, issued_on, due_on, paid_on, payment_url
    FROM invoices
    WHERE demo_id = ${site.id} AND status <> 'draft'
    ORDER BY issued_on DESC, id DESC
  `;

  const requests = await sql`
    SELECT r.id, r.page, r.body, r.priority, r.status, r.studio_reply,
           r.created_at, r.updated_at, r.completed_at, a.name AS author
    FROM change_requests r
    LEFT JOIN client_accounts a ON a.id = r.account_id
    WHERE r.demo_id = ${site.id}
    ORDER BY r.created_at DESC, r.id DESC
  `;

  return {
    account: { name: account.name, email: account.email },
    site: {
      name: site.business_name,
      url: site.demo_url,
      liveSince: site.created_at,
    },
    stats: { days: STATS_DAYS, daily, totals, referrers },
    invoices,
    requests,
  };
}

// Builds the reset link on whichever host the request came in on (live site or a preview)
function resetLink(req, token) {
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "www.blueprintwebstudio.com");
  const safeHost = /^[a-z0-9.-]+(:\d+)?$/i.test(host) ? host : "www.blueprintwebstudio.com";
  return `https://${safeHost}/portal/?reset=${token}`;
}

async function sendResetEmail(account, link) {
  const resend = new Resend(process.env.RESEND_API_KEY);
  const firstName = account.name.split(/\s+/)[0];
  const { error } = await resend.emails.send({
    from: NOTIFY_FROM,
    to: [account.email],
    replyTo: STUDIO_INBOX,
    subject: "Reset your Blueprint WebStudio portal password",
    text: [
      `Hi ${firstName},`,
      "",
      "Someone asked to reset the password for your Blueprint WebStudio client portal account. To choose a new one, open this link within the next hour:",
      "",
      link,
      "",
      "If you didn't ask for this, you can ignore this email and your password stays the same.",
      "",
      "Blueprint WebStudio",
      "hello@blueprintwebstudio.com",
    ].join("\n"),
    html: `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:#09192f;max-width:560px">
<p>Hi ${firstName.replace(/[<>&"]/g, "")},</p>
<p>Someone asked to reset the password for your Blueprint WebStudio client portal account. To choose a new one, use this button within the next hour:</p>
<p><a href="${link}" style="display:inline-block;padding:12px 22px;background:#0869e8;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:bold">Choose a new password</a></p>
<p style="color:#5b6679;font-size:13px">Or paste this link into your browser:<br>${link}</p>
<p>If you didn't ask for this, you can ignore this email and your password stays the same.</p>
<p>Blueprint WebStudio<br><a href="mailto:hello@blueprintwebstudio.com" style="color:#0869e8">hello@blueprintwebstudio.com</a></p>
</div>`,
  });
  if (error) throw new Error(error.message || "Resend error");
}

async function notifyStudio(site, account, request) {
  if (!process.env.RESEND_API_KEY) return;

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: NOTIFY_FROM,
      to: [STUDIO_INBOX],
      replyTo: account.email,
      subject: `New change request: ${site.business_name} (#${request.id})`,
      text: [
        `${account.name} (${account.email}) asked for a change on ${site.demo_url}.`,
        "",
        `Page: ${request.page || "Not given"}`,
        `Priority: ${request.priority}`,
        "",
        request.body,
        "",
        "Stored in Neon: change_requests id " + request.id,
      ].join("\n"),
    });
  } catch (error) {
    // The request is saved either way; the email is only a heads-up
    console.error("Change request notice failed:", error);
  }
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return fail(res, 405, "Method not allowed.");
  }

  const connectionString = process.env.BLUEPRINT_DB_DATABASE_URL;
  if (!connectionString) {
    console.error("Missing BLUEPRINT_DB_DATABASE_URL environment variable.");
    return fail(res, 500, "The client portal is temporarily unavailable.");
  }

  try {
    const sql = neon(connectionString);
    const { action = "me" } = req.body ?? {};

    if (action === "signup") {
      const code = text(req.body.code, 20).toUpperCase();
      const name = text(req.body.name, 120);
      const email = text(req.body.email, 200).toLowerCase();
      const password = typeof req.body.password === "string" ? req.body.password : "";

      if (!code) return fail(res, 400, "Enter the access code for your site.");
      if (!name) return fail(res, 400, "Enter your name.");
      if (!EMAIL_PATTERN.test(email)) return fail(res, 400, "That email address doesn't look right.");
      if (password.length < MIN_PASSWORD) {
        return fail(res, 400, `Use a password with at least ${MIN_PASSWORD} characters.`);
      }

      const sites = await sql`
        SELECT id FROM demos
        WHERE UPPER(demo_code) = ${code}
          AND status = 'active'
          AND is_admin = false
          AND portal_enabled = true
        LIMIT 1
      `;
      if (sites.length === 0) {
        return fail(res, 404, "We couldn't find a client portal for that access code.");
      }

      const existing = await sql`
        SELECT id FROM client_accounts WHERE lower(email) = ${email} LIMIT 1
      `;
      if (existing.length > 0) {
        return fail(res, 409, "There's already an account for that email. Sign in instead.");
      }

      const [account] = await sql`
        INSERT INTO client_accounts (demo_id, name, email, password_hash, last_login_at)
        VALUES (${sites[0].id}, ${name}, ${email}, ${await hashPassword(password)}, NOW())
        RETURNING id, name, email, demo_id
      `;

      res.setHeader("Set-Cookie", await startSession(sql, account.id));
      return res.status(200).json({ success: true, ...(await loadDashboard(sql, account)) });
    }

    if (action === "signin") {
      const email = text(req.body.email, 200).toLowerCase();
      const password = typeof req.body.password === "string" ? req.body.password : "";

      const rows = await sql`
        SELECT a.id, a.name, a.email, a.demo_id, a.password_hash
        FROM client_accounts a
        JOIN demos d ON d.id = a.demo_id
        WHERE lower(a.email) = ${email}
          AND a.disabled_at IS NULL
          AND d.status = 'active'
          AND d.portal_enabled = true
        LIMIT 1
      `;
      const account = rows[0];

      if (!account || !(await checkPassword(password, account.password_hash))) {
        return fail(res, 401, "That email and password don't match.");
      }

      await sql`UPDATE client_accounts SET last_login_at = NOW() WHERE id = ${account.id}`;
      res.setHeader("Set-Cookie", await startSession(sql, account.id));
      return res.status(200).json({ success: true, ...(await loadDashboard(sql, account)) });
    }

    if (action === "requestReset") {
      const email = text(req.body.email, 200).toLowerCase();
      if (!EMAIL_PATTERN.test(email)) return fail(res, 400, "That email address doesn't look right.");

      // Same answer whether or not the account exists, so the form can't be used to find accounts
      const rows = await sql`
        SELECT a.id, a.name, a.email
        FROM client_accounts a
        JOIN demos d ON d.id = a.demo_id
        WHERE lower(a.email) = ${email}
          AND a.disabled_at IS NULL
          AND d.status = 'active'
          AND d.portal_enabled = true
          AND NOT EXISTS (
            SELECT 1 FROM client_password_resets r
            WHERE r.account_id = a.id AND r.created_at > NOW() - interval '2 minutes'
          )
        LIMIT 1
      `;
      const account = rows[0];

      if (account) {
        if (!process.env.RESEND_API_KEY) {
          console.error("Missing RESEND_API_KEY; can't send a password reset.");
          return fail(res, 500, "Password reset emails aren't available right now. Email hello@blueprintwebstudio.com.");
        }
        const token = randomBytes(32).toString("base64url");
        await sql`
          INSERT INTO client_password_resets (token_hash, account_id, expires_at)
          VALUES (${hashToken(token)}, ${account.id}, NOW() + make_interval(mins => ${RESET_MINUTES}))
        `;
        try {
          await sendResetEmail(account, resetLink(req, token));
        } catch (error) {
          console.error("Password reset email failed:", error);
          return fail(res, 502, "We couldn't send the email. Please try again in a minute.");
        }
      }

      return res.status(200).json({ success: true, message: RESET_SENT });
    }

    if (action === "resetPassword") {
      const token = text(req.body.token, 200);
      const password = typeof req.body.password === "string" ? req.body.password : "";
      if (password.length < MIN_PASSWORD) {
        return fail(res, 400, `Use a password with at least ${MIN_PASSWORD} characters.`);
      }

      // Using the token marks it spent in the same statement, so a link works once
      const used = await sql`
        UPDATE client_password_resets
        SET used_at = NOW()
        WHERE token_hash = ${hashToken(token)}
          AND used_at IS NULL
          AND expires_at > NOW()
        RETURNING account_id
      `;
      if (used.length === 0) {
        return fail(res, 400, "That reset link has expired or was already used. Ask for a new one.");
      }

      const [account] = await sql`
        UPDATE client_accounts
        SET password_hash = ${await hashPassword(password)}, last_login_at = NOW()
        WHERE id = ${used[0].account_id} AND disabled_at IS NULL
        RETURNING id, name, email, demo_id
      `;
      if (!account) return fail(res, 400, "That account is no longer active.");

      // Sign out every other device and retire any other open reset links
      await sql`DELETE FROM client_sessions WHERE account_id = ${account.id}`;
      await sql`
        UPDATE client_password_resets SET used_at = NOW()
        WHERE account_id = ${account.id} AND used_at IS NULL
      `;

      res.setHeader("Set-Cookie", await startSession(sql, account.id));
      return res.status(200).json({ success: true, ...(await loadDashboard(sql, account)) });
    }

    if (action === "signout") {
      await endSession(sql, req);
      res.setHeader("Set-Cookie", clearedCookie());
      return res.status(200).json({ success: true });
    }

    // Everything below needs a signed-in client
    const account = await currentAccount(sql, req);
    if (!account) {
      res.setHeader("Set-Cookie", clearedCookie());
      // Opening the page signed out is normal, so it isn't an error
      if (action === "me") return res.status(200).json({ success: true, signedIn: false });
      return fail(res, 401, "Please sign in.");
    }

    if (action === "addRequest") {
      const body = text(req.body.body, MAX_REQUEST_LENGTH + 1);
      const page = text(req.body.page, 120);
      const priority = PRIORITIES.includes(req.body.priority) ? req.body.priority : "normal";

      if (!body) return fail(res, 400, "Describe the change you'd like.");
      if (body.length > MAX_REQUEST_LENGTH) return fail(res, 400, "That request is too long.");

      const [request] = await sql`
        INSERT INTO change_requests (demo_id, account_id, page, body, priority)
        VALUES (${account.demo_id}, ${account.id}, ${page || null}, ${body}, ${priority})
        RETURNING id, page, body, priority
      `;
      const [site] = await sql`
        SELECT business_name, demo_url FROM demos WHERE id = ${account.demo_id}
      `;
      await notifyStudio(site, account, request);
    } else if (action === "cancelRequest") {
      // Clients can withdraw a request until the studio starts on it
      const id = Number(req.body.requestId);
      if (!Number.isSafeInteger(id)) return fail(res, 400, "Request not found.");

      const removed = await sql`
        DELETE FROM change_requests
        WHERE id = ${id} AND demo_id = ${account.demo_id} AND status = 'new'
        RETURNING id
      `;
      if (removed.length === 0) {
        return fail(res, 409, "That request is already in progress, so it can't be withdrawn.");
      }
    } else if (action !== "me") {
      return fail(res, 400, "Unknown action.");
    }

    return res.status(200).json({ success: true, ...(await loadDashboard(sql, account)) });
  } catch (error) {
    console.error("Client portal error:", error);
    return fail(res, 500, "We couldn't load your dashboard right now. Please try again.");
  }
}
