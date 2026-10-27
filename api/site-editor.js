import { createHash } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { Resend } from "resend";
import { currentAccount } from "../lib/portal-auth.js";

// The client site editor. One function serves three things:
//   GET  ?site=<host>  the published edits a client site applies over its built-in content (public)
//   GET  ?asset=<id>   an image a client uploaded in the editor (public)
//   POST {action}      the portal editor: load, save a draft, publish, restore, upload (signed-in clients)
//
// Edits are stored as overrides only (field key -> value). Each site keeps its own defaults in code
// and decides which keys exist and what values are allowed, so a site redeploy never loses edits.

const STUDIO_INBOX = "hello@blueprintwebstudio.com";
const NOTIFY_FROM = "Blueprint WebStudio Portal <hello@blueprintwebstudio.com>";
const MAX_KEYS = 400;
const MAX_VALUE = 6000;
const MAX_CONTENT_BYTES = 200_000;
const MAX_UPLOAD_BYTES = 3 * 1024 * 1024;
const HISTORY_LIMIT = 30;
const KEY_PATTERN = /^[a-z0-9][a-z0-9_.-]{0,79}$/i;
const HOST_PATTERN = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i;
const ASSET_PATTERN = /^[a-f0-9]{32}$/;

// Uploads are checked by their first bytes, not the name or type the browser claims.
// SVG is left out on purpose: it can carry scripts.
const IMAGE_TYPES = [
  { type: "image/jpeg", ext: "jpg", test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { type: "image/png", ext: "png", test: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { type: "image/webp", ext: "webp", test: (b) => b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP" },
  { type: "image/gif", ext: "gif", test: (b) => b.subarray(0, 4).toString("latin1") === "GIF8" },
];

function fail(res, status, message) {
  return res.status(status).json({ success: false, message });
}

// Keeps only well-formed overrides; anything else is dropped, never stored
function cleanContent(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const clean = {};
  for (const [key, value] of Object.entries(input).slice(0, MAX_KEYS)) {
    if (!KEY_PATTERN.test(key)) continue;
    if (typeof value === "string") clean[key] = value.slice(0, MAX_VALUE);
    else if (typeof value === "number" && Number.isFinite(value)) clean[key] = value;
    else if (typeof value === "boolean") clean[key] = value;
  }
  return clean;
}

function changedKeys(before, after) {
  const keys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
  return [...keys].filter((key) => JSON.stringify(before?.[key]) !== JSON.stringify(after?.[key])).sort();
}

// bytea comes back as bytes, or as "\\x…" hex text depending on the driver's type parsing
function toBuffer(value) {
  if (typeof value === "string") return Buffer.from(value.replace(/^\\x/, ""), "hex");
  return Buffer.from(value);
}

function assetBase(req) {
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "www.blueprintwebstudio.com");
  const safeHost = /^[a-z0-9.-]+(:\d+)?$/i.test(host) ? host : "www.blueprintwebstudio.com";
  return `https://${safeHost}/api/site-editor?asset=`;
}

async function serveContent(sql, req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  const host = String(req.query.site || "").toLowerCase().replace(/^www\./, "");
  if (!HOST_PATTERN.test(host)) return fail(res, 400, "Unknown site.");

  const rows = await sql`
    SELECT c.published, c.published_at, c.published_version
    FROM demos d
    JOIN site_content c ON c.demo_id = d.id
    WHERE d.status = 'active'
      AND d.editor_enabled = true
      AND rtrim(lower(d.demo_url), '/') = ANY(${[`https://${host}`, `https://www.${host}`]})
    LIMIT 1
  `;

  // Short edge cache so a publish shows up within seconds, without a database hit per visitor
  res.setHeader("Cache-Control", "public, max-age=0, s-maxage=5, stale-while-revalidate=60");
  const row = rows[0];
  return res.status(200).json({
    success: true,
    content: row?.published ?? {},
    version: row?.published_version ?? 0,
    publishedAt: row?.published_at ?? null,
  });
}

async function serveAsset(sql, req, res) {
  const id = String(req.query.asset || "");
  if (!ASSET_PATTERN.test(id)) return res.status(404).end();

  const rows = await sql`
    SELECT a.content_type, a.data
    FROM site_assets a
    JOIN demos d ON d.id = a.demo_id
    WHERE a.id = ${id} AND d.status = 'active'
    LIMIT 1
  `;
  if (rows.length === 0) return res.status(404).end();

  // The id is a hash of the bytes, so the file at this address never changes
  res.setHeader("Content-Type", rows[0].content_type);
  res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Content-Security-Policy", "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  return res.status(200).send(toBuffer(rows[0].data));
}

async function loadEditor(sql, account) {
  const [site] = await sql`
    SELECT d.id, d.business_name, d.demo_url, d.editor_enabled,
           c.draft, c.draft_updated_at, c.published, c.published_at, c.published_version
    FROM demos d
    LEFT JOIN site_content c ON c.demo_id = d.id
    WHERE d.id = ${account.demo_id}
  `;

  const versions = await sql`
    SELECT id, author, created_at, (SELECT COUNT(*) FROM jsonb_object_keys(content))::int AS edits
    FROM site_content_versions
    WHERE demo_id = ${site.id}
    ORDER BY created_at DESC, id DESC
    LIMIT ${HISTORY_LIMIT}
  `;

  return {
    account: { name: account.name, email: account.email },
    site: { name: site.business_name, url: site.demo_url, enabled: site.editor_enabled },
    published: site.published ?? {},
    publishedAt: site.published_at,
    publishedVersion: site.published_version ?? 0,
    draft: site.draft,
    draftUpdatedAt: site.draft_updated_at,
    versions: versions.map((v) => ({ id: v.id, author: v.author, createdAt: v.created_at, edits: v.edits })),
  };
}

async function notifyStudio(site, account, keys) {
  if (!process.env.RESEND_API_KEY) return;

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const shown = keys.slice(0, 40);
    await resend.emails.send({
      from: NOTIFY_FROM,
      to: [STUDIO_INBOX],
      replyTo: account.email,
      subject: `Site edits published: ${site.business_name}`,
      text: [
        `${account.name} (${account.email}) published edits to ${site.demo_url} from the client portal editor.`,
        "",
        `Fields changed (${keys.length}):`,
        ...shown.map((key) => `- ${key}`),
        keys.length > shown.length ? `…and ${keys.length - shown.length} more` : "",
        "",
        "Every publish is kept in Neon (site_content_versions), and the client can restore an earlier one from the editor's History.",
      ].join("\n"),
    });
  } catch (error) {
    // The publish is saved either way; the email is only a heads-up
    console.error("Site edit notice failed:", error);
  }
}

export default async function handler(req, res) {
  res.setHeader("X-Robots-Tag", "noindex, nofollow");

  const connectionString = process.env.BLUEPRINT_DB_DATABASE_URL;
  if (!connectionString) {
    console.error("Missing BLUEPRINT_DB_DATABASE_URL environment variable.");
    return fail(res, 500, "The site editor is temporarily unavailable.");
  }

  const sql = neon(connectionString);

  if (req.method === "GET") {
    try {
      if (req.query.asset) return await serveAsset(sql, req, res);
      return await serveContent(sql, req, res);
    } catch (error) {
      console.error("Site content error:", error);
      res.setHeader("Cache-Control", "no-store");
      return fail(res, 500, "Content unavailable.");
    }
  }

  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return fail(res, 405, "Method not allowed.");
  }

  try {
    const account = await currentAccount(sql, req);
    if (!account) return fail(res, 401, "Please sign in.");

    const [site] = await sql`
      SELECT id, business_name, demo_url, editor_enabled FROM demos WHERE id = ${account.demo_id}
    `;
    const { action = "load" } = req.body ?? {};

    if (action !== "load" && !site.editor_enabled) {
      return fail(res, 403, "The editor isn't turned on for your site yet. Email hello@blueprintwebstudio.com and we'll set it up.");
    }

    if (action === "saveDraft") {
      const draft = cleanContent(req.body.content);
      if (JSON.stringify(draft).length > MAX_CONTENT_BYTES) return fail(res, 413, "That's more content than the editor can save.");
      await sql`
        INSERT INTO site_content (demo_id, draft, draft_updated_at)
        VALUES (${site.id}, ${JSON.stringify(draft)}::jsonb, NOW())
        ON CONFLICT (demo_id) DO UPDATE SET draft = EXCLUDED.draft, draft_updated_at = NOW()
      `;
      return res.status(200).json({ success: true, savedAt: new Date().toISOString() });
    }

    if (action === "publish") {
      const content = cleanContent(req.body.content);
      if (JSON.stringify(content).length > MAX_CONTENT_BYTES) return fail(res, 413, "That's more content than the editor can save.");

      const [before] = await sql`SELECT published FROM site_content WHERE demo_id = ${site.id}`;
      const keys = changedKeys(before?.published ?? {}, content);
      if (keys.length === 0) {
        await sql`UPDATE site_content SET draft = NULL, draft_updated_at = NULL WHERE demo_id = ${site.id}`;
      } else {
        const [version] = await sql`
          INSERT INTO site_content_versions (demo_id, content, account_id, author)
          VALUES (${site.id}, ${JSON.stringify(content)}::jsonb, ${account.id}, ${account.name})
          RETURNING id
        `;
        await sql`
          INSERT INTO site_content (demo_id, published, published_at, published_version, draft, draft_updated_at)
          VALUES (${site.id}, ${JSON.stringify(content)}::jsonb, NOW(), ${version.id}, NULL, NULL)
          ON CONFLICT (demo_id) DO UPDATE SET
            published = EXCLUDED.published,
            published_at = NOW(),
            published_version = EXCLUDED.published_version,
            draft = NULL,
            draft_updated_at = NULL
        `;
        await notifyStudio(site, account, keys);
      }
    } else if (action === "discardDraft") {
      await sql`UPDATE site_content SET draft = NULL, draft_updated_at = NULL WHERE demo_id = ${site.id}`;
    } else if (action === "version") {
      // An earlier publish, for the editor to load as a new draft
      const id = Number(req.body.versionId);
      if (!Number.isSafeInteger(id)) return fail(res, 400, "Version not found.");
      const rows = await sql`
        SELECT content FROM site_content_versions WHERE id = ${id} AND demo_id = ${site.id}
      `;
      if (rows.length === 0) return fail(res, 404, "Version not found.");
      return res.status(200).json({ success: true, content: rows[0].content });
    } else if (action === "upload") {
      const data = typeof req.body.data === "string" ? Buffer.from(req.body.data, "base64") : Buffer.alloc(0);
      if (data.length === 0) return fail(res, 400, "Choose an image to upload.");
      if (data.length > MAX_UPLOAD_BYTES) return fail(res, 413, "That image is too large. Try one under 3 MB.");

      const kind = IMAGE_TYPES.find((entry) => entry.test(data));
      if (!kind) return fail(res, 415, "Use a JPG, PNG, WebP or GIF image.");

      const id = createHash("sha256").update(data).digest("hex").slice(0, 32);
      const filename = String(req.body.filename || `image.${kind.ext}`).slice(0, 160);
      await sql`
        INSERT INTO site_assets (id, demo_id, account_id, filename, content_type, size_bytes, data)
        VALUES (${id}, ${site.id}, ${account.id}, ${filename}, ${kind.type}, ${data.length}, ${`\\x${data.toString("hex")}`}::bytea)
        ON CONFLICT (id) DO NOTHING
      `;
      return res.status(200).json({ success: true, url: assetBase(req) + id });
    } else if (action !== "load") {
      return fail(res, 400, "Unknown action.");
    }

    return res.status(200).json({ success: true, ...(await loadEditor(sql, account)) });
  } catch (error) {
    console.error("Site editor error:", error);
    return fail(res, 500, "We couldn't reach the editor right now. Please try again.");
  }
}
