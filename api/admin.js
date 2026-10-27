import { neon } from "@neondatabase/serverless";
import { checkPassword, hashPassword } from "../lib/portal-auth.js";
import {
  LOCK_MINUTES,
  MAX_FAILED_LOGINS,
  clearedAdminCookie,
  currentAdmin,
  endAdminSession,
  reviewCode,
  startAdminSession,
} from "../lib/admin-auth.js";

const EMAIL_PATTERN = /^[^\s@<>,;]+@[^\s@<>,;]+\.[a-z]{2,}$/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MIN_PASSWORD = 10;
const CONTRACT_STATUSES = ["draft", "sent", "signed", "in_progress", "complete", "cancelled"];
const MILESTONE_STATUSES = ["planned", "in_progress", "done"];
// Contracts that count toward booked work and monthly recurring revenue
const BOOKED = ["signed", "in_progress", "complete"];
const FILE_CATEGORIES = ["Agreement", "Invoice", "Design", "Site files", "Other"];
// Vercel caps a request at 4.5 MB and base64 adds a third, so 3 MB of file fits
const MAX_UPLOAD_BYTES = 3 * 1024 * 1024;

function fail(res, status, message) {
  return res.status(status).json({ success: false, message });
}

function text(value, max = 200) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function dateOrNull(value) {
  return DATE_PATTERN.test(value ?? "") ? value : null;
}

function toId(value) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function cents(value) {
  const amount = Math.round(Number(value) * 100);
  return Number.isSafeInteger(amount) && amount >= 0 ? amount : null;
}

// Cleans the editor's contract into what's stored; returns { contract } or { error }
function cleanContract(input) {
  const costItems = [];
  for (const item of Array.isArray(input?.costItems) ? input.costItems.slice(0, 50) : []) {
    const label = text(item?.label, 160);
    if (!label) continue;
    const amount = cents(item?.amount);
    if (amount === null) return { error: `Enter a dollar amount for "${label}".` };
    costItems.push({ label, details: text(item?.details, 600), amount_cents: amount });
  }

  const timeline = [];
  for (const step of Array.isArray(input?.timeline) ? input.timeline.slice(0, 30) : []) {
    const title = text(step?.title, 160);
    if (!title) continue;
    const deliverables = (Array.isArray(step?.deliverables) ? step.deliverables.slice(0, 30) : [])
      .map((entry) => ({ title: text(entry?.title, 200), done: Boolean(entry?.done) }))
      .filter((entry) => entry.title);
    timeline.push({
      title,
      details: text(step?.details, 1000),
      due_on: dateOrNull(step?.dueOn),
      status: MILESTONE_STATUSES.includes(step?.status) ? step.status : "planned",
      deliverables,
    });
  }

  const monthly = input?.monthly === "" || input?.monthly == null ? 0 : cents(input.monthly);
  if (monthly === null) return { error: "Enter the monthly support cost in dollars." };

  return {
    contract: {
      title: text(input?.title, 160) || "Website project",
      status: CONTRACT_STATUSES.includes(input?.status) ? input.status : "draft",
      published: Boolean(input?.published),
      summary: text(input?.summary, 4000) || null,
      signed_on: dateOrNull(input?.signedOn),
      start_on: dateOrNull(input?.startOn),
      launch_on: dateOrNull(input?.launchOn),
      cost_items: costItems,
      payment_terms: text(input?.paymentTerms, 2000) || null,
      monthly_cents: monthly,
      monthly_label: text(input?.monthlyLabel, 120) || null,
      monthly_includes: (Array.isArray(input?.monthlyIncludes) ? input.monthlyIncludes.slice(0, 30) : [])
        .map((line) => text(line, 200))
        .filter(Boolean),
      monthly_starts_on: dateOrNull(input?.monthlyStartsOn),
      timeline,
      private_notes: text(input?.privateNotes, 4000) || null,
    },
  };
}

const projectTotal = (contract) =>
  (contract.cost_items || []).reduce((total, item) => total + (item.amount_cents || 0), 0);

async function loadDashboard(sql, admin) {
  const demos = await sql`
    SELECT d.id, d.business_name, d.demo_url, d.demo_code, d.status, d.city, d.category,
           d.portal_enabled, d.emailed_at, d.view_count, d.contact_name, d.contact_email,
           (SELECT COUNT(*)::int FROM client_accounts a WHERE a.demo_id = d.id AND a.disabled_at IS NULL) AS accounts
    FROM demos d
    WHERE d.is_admin = false
    ORDER BY d.business_name
  `;

  const contracts = await sql`
    SELECT c.id, c.demo_id, c.title, c.status, c.published, c.summary,
           to_char(c.signed_on, 'YYYY-MM-DD') AS signed_on,
           to_char(c.start_on, 'YYYY-MM-DD') AS start_on,
           to_char(c.launch_on, 'YYYY-MM-DD') AS launch_on,
           c.cost_items, c.payment_terms, c.monthly_cents, c.monthly_label, c.monthly_includes,
           to_char(c.monthly_starts_on, 'YYYY-MM-DD') AS monthly_starts_on,
           c.timeline, c.private_notes, c.created_at, c.updated_at,
           d.business_name, d.demo_url, d.portal_enabled
    FROM contracts c
    JOIN demos d ON d.id = c.demo_id
    ORDER BY c.updated_at DESC
  `;

  // File list only; the bytes stay in the table
  const files = await sql`
    SELECT id, demo_id, title, filename, content_type, size_bytes, note, category, created_at
    FROM client_files
    ORDER BY created_at DESC, id DESC
  `;

  const requests = await sql`
    SELECT r.id, r.demo_id, d.business_name, r.page, r.body, r.priority, r.status, r.created_at
    FROM change_requests r
    JOIN demos d ON d.id = r.demo_id
    WHERE r.status IN ('new', 'in_progress')
    ORDER BY (r.priority = 'high') DESC, r.created_at
  `;

  const [money] = await sql`
    SELECT
      COALESCE(SUM(amount_cents) FILTER (WHERE status = 'open'), 0)::bigint AS due_cents,
      COALESCE(SUM(amount_cents) FILTER (
        WHERE status = 'paid' AND date_trunc('month', paid_on) = date_trunc('month', CURRENT_DATE)
      ), 0)::bigint AS paid_month_cents,
      COALESCE(SUM(amount_cents) FILTER (WHERE status = 'paid'), 0)::bigint AS paid_total_cents
    FROM invoices
  `;

  const booked = contracts.filter((contract) => BOOKED.includes(contract.status));

  return {
    admin: { name: admin.name, email: admin.email },
    reviewCode: await reviewCode(sql),
    overview: {
      concepts: demos.length,
      emailed: demos.filter((demo) => demo.emailed_at).length,
      opened: demos.filter((demo) => demo.view_count > 0).length,
      portals: demos.filter((demo) => demo.portal_enabled).length,
      clientAccounts: demos.reduce((total, demo) => total + demo.accounts, 0),
      openRequests: requests.length,
      contracts: contracts.length,
      booked: booked.length,
      bookedCents: booked.reduce((total, contract) => total + projectTotal(contract), 0),
      monthlyCents: booked.reduce((total, contract) => total + contract.monthly_cents, 0),
      dueCents: Number(money.due_cents),
      paidMonthCents: Number(money.paid_month_cents),
      paidTotalCents: Number(money.paid_total_cents),
    },
    demos,
    contracts,
    files,
    requests,
    uploadLimit: MAX_UPLOAD_BYTES,
    fileCategories: FILE_CATEGORIES,
  };
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
    return fail(res, 500, "The dashboard is temporarily unavailable.");
  }

  try {
    const sql = neon(connectionString);
    const { action = "me" } = req.body ?? {};

    // The first login is made once, by someone who knows the review code
    if (action === "setup") {
      const [{ count }] = await sql`SELECT COUNT(*)::int AS count FROM admin_accounts`;
      if (count > 0) return fail(res, 409, "The studio login is already set up. Sign in instead.");

      const code = text(req.body.code, 40).toUpperCase();
      const name = text(req.body.name, 120);
      const email = text(req.body.email, 200).toLowerCase();
      const password = typeof req.body.password === "string" ? req.body.password : "";
      const expected = await reviewCode(sql);

      if (!expected || code !== expected.toUpperCase()) return fail(res, 401, "That review code isn't valid.");
      if (!name) return fail(res, 400, "Enter your name.");
      if (!EMAIL_PATTERN.test(email)) return fail(res, 400, "That email address doesn't look right.");
      if (password.length < MIN_PASSWORD) {
        return fail(res, 400, `Use a password with at least ${MIN_PASSWORD} characters.`);
      }

      const [admin] = await sql`
        INSERT INTO admin_accounts (name, email, password_hash, last_login_at)
        VALUES (${name}, ${email}, ${await hashPassword(password)}, NOW())
        RETURNING id, name, email
      `;
      res.setHeader("Set-Cookie", await startAdminSession(sql, admin.id));
      return res.status(200).json({ success: true, ...(await loadDashboard(sql, admin)) });
    }

    if (action === "signin") {
      const email = text(req.body.email, 200).toLowerCase();
      const password = typeof req.body.password === "string" ? req.body.password : "";

      const rows = await sql`
        SELECT id, name, email, password_hash, locked_until > NOW() AS locked
        FROM admin_accounts WHERE lower(email) = ${email} LIMIT 1
      `;
      const admin = rows[0];
      if (admin?.locked) {
        return fail(res, 429, `Too many tries. Wait ${LOCK_MINUTES} minutes and sign in again.`);
      }
      if (!admin || !(await checkPassword(password, admin.password_hash))) {
        if (admin) {
          // Five wrong passwords in a row lock the login for a while
          await sql`
            UPDATE admin_accounts
            SET failed_logins = failed_logins + 1,
                locked_until = CASE WHEN failed_logins + 1 >= ${MAX_FAILED_LOGINS}
                  THEN NOW() + make_interval(mins => ${LOCK_MINUTES}) ELSE locked_until END
            WHERE id = ${admin.id}
          `;
        }
        return fail(res, 401, "That email and password don't match.");
      }

      await sql`
        UPDATE admin_accounts SET failed_logins = 0, locked_until = NULL, last_login_at = NOW()
        WHERE id = ${admin.id}
      `;
      res.setHeader("Set-Cookie", await startAdminSession(sql, admin.id));
      return res.status(200).json({ success: true, ...(await loadDashboard(sql, admin)) });
    }

    if (action === "signout") {
      await endAdminSession(sql, req);
      res.setHeader("Set-Cookie", clearedAdminCookie());
      return res.status(200).json({ success: true });
    }

    const admin = await currentAdmin(sql, req);
    if (!admin) {
      res.setHeader("Set-Cookie", clearedAdminCookie());
      if (action === "me") {
        const [{ count }] = await sql`SELECT COUNT(*)::int AS count FROM admin_accounts`;
        return res.status(200).json({ success: true, signedIn: false, needsSetup: count === 0 });
      }
      return fail(res, 401, "Please sign in.");
    }

    if (action === "saveContract") {
      const demoId = toId(req.body.demoId);
      if (!demoId) return fail(res, 400, "Pick a client first.");
      const { contract, error } = cleanContract(req.body.contract);
      if (error) return fail(res, 400, error);

      const saved = await sql`
        INSERT INTO contracts (
          demo_id, title, status, published, summary, signed_on, start_on, launch_on,
          cost_items, payment_terms, monthly_cents, monthly_label, monthly_includes,
          monthly_starts_on, timeline, private_notes
        )
        SELECT
          id, ${contract.title}, ${contract.status}, ${contract.published}, ${contract.summary},
          ${contract.signed_on}::date, ${contract.start_on}::date, ${contract.launch_on}::date,
          ${JSON.stringify(contract.cost_items)}::jsonb, ${contract.payment_terms}, ${contract.monthly_cents},
          ${contract.monthly_label}, ${JSON.stringify(contract.monthly_includes)}::jsonb,
          ${contract.monthly_starts_on}::date, ${JSON.stringify(contract.timeline)}::jsonb, ${contract.private_notes}
        FROM demos WHERE id = ${demoId} AND is_admin = false
        ON CONFLICT (demo_id) DO UPDATE SET
          title = EXCLUDED.title,
          status = EXCLUDED.status,
          published = EXCLUDED.published,
          summary = EXCLUDED.summary,
          signed_on = EXCLUDED.signed_on,
          start_on = EXCLUDED.start_on,
          launch_on = EXCLUDED.launch_on,
          cost_items = EXCLUDED.cost_items,
          payment_terms = EXCLUDED.payment_terms,
          monthly_cents = EXCLUDED.monthly_cents,
          monthly_label = EXCLUDED.monthly_label,
          monthly_includes = EXCLUDED.monthly_includes,
          monthly_starts_on = EXCLUDED.monthly_starts_on,
          timeline = EXCLUDED.timeline,
          private_notes = EXCLUDED.private_notes,
          updated_at = NOW()
        RETURNING id
      `;
      if (saved.length === 0) return fail(res, 404, "Client not found.");
    } else if (action === "deleteContract") {
      const demoId = toId(req.body.demoId);
      if (!demoId) return fail(res, 400, "Contract not found.");
      await sql`DELETE FROM contracts WHERE demo_id = ${demoId}`;
    } else if (action === "setPortal") {
      const demoId = toId(req.body.demoId);
      if (!demoId) return fail(res, 400, "Client not found.");
      await sql`
        UPDATE demos SET portal_enabled = ${Boolean(req.body.enabled)}
        WHERE id = ${demoId} AND is_admin = false
      `;
    } else if (action === "uploadFile") {
      const demoId = toId(req.body.demoId);
      const title = text(req.body.title, 160);
      const filename = text(req.body.filename, 200);
      const contentType = /^[\w.+-]+\/[\w.+-]+$/.test(req.body.contentType || "")
        ? req.body.contentType
        : "application/octet-stream";
      const category = FILE_CATEGORIES.includes(req.body.category) ? req.body.category : null;
      const note = text(req.body.note, 600);
      const data = typeof req.body.data === "string" ? Buffer.from(req.body.data, "base64") : null;

      if (!demoId) return fail(res, 400, "Pick a client first.");
      if (!filename || !data?.length) return fail(res, 400, "Choose a file to upload.");
      if (data.length > MAX_UPLOAD_BYTES) return fail(res, 413, "That file is over 3 MB.");

      const added = await sql`
        INSERT INTO client_files (demo_id, title, filename, content_type, size_bytes, note, category, data)
        SELECT id, ${title || filename}, ${filename}, ${contentType}, ${data.length}, ${note || null},
               ${category}, decode(${data.toString("base64")}, 'base64')
        FROM demos WHERE id = ${demoId} AND is_admin = false
        RETURNING id
      `;
      if (added.length === 0) return fail(res, 404, "Client not found.");
    } else if (action === "deleteFile") {
      const fileId = toId(req.body.fileId);
      if (!fileId) return fail(res, 400, "File not found.");
      await sql`DELETE FROM client_files WHERE id = ${fileId}`;
    } else if (action !== "me") {
      return fail(res, 400, "Unknown action.");
    }

    return res.status(200).json({ success: true, ...(await loadDashboard(sql, admin)) });
  } catch (error) {
    console.error("Admin dashboard error:", error);
    return fail(res, 500, "We couldn't load the dashboard right now. Please try again.");
  }
}
