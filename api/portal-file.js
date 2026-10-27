import { neon } from "@neondatabase/serverless";
import { currentAccount } from "../lib/portal-auth.js";

// Sends one file from the Files tab, only to a signed-in client of the site it belongs to.
// A file is stored in the row itself (data) or, for larger builds, pinned to a
// commit in one of the studio's GitHub repos (source_url) and passed through.
const SOURCE_PATTERN = /^https:\/\/raw\.githubusercontent\.com\/mr-werner\/[\w.-]+\/[0-9a-f]{40}\//;
const MAX_BYTES = 4 * 1024 * 1024;
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).end();
  }

  const connectionString = process.env.BLUEPRINT_DB_DATABASE_URL;
  if (!connectionString) return res.status(500).send("The client portal is temporarily unavailable.");

  const id = Number(req.query?.id);
  if (!Number.isSafeInteger(id)) return res.status(404).send("File not found.");

  try {
    const sql = neon(connectionString);
    const account = await currentAccount(sql, req);
    if (!account) return res.status(401).send("Please sign in to the client portal to download this file.");

    const rows = await sql`
      SELECT filename, content_type, encode(data, 'base64') AS data, source_url
      FROM client_files
      WHERE id = ${id} AND demo_id = ${account.demo_id}
    `;
    const file = rows[0];
    if (!file) return res.status(404).send("File not found.");

    let body;
    if (file.data) {
      body = Buffer.from(file.data, "base64");
    } else {
      if (!SOURCE_PATTERN.test(file.source_url || "")) throw new Error(`Source not allowed for file ${id}`);
      const source = await fetch(file.source_url);
      if (!source.ok) throw new Error(`Source returned ${source.status} for file ${id}`);
      body = Buffer.from(await source.arrayBuffer());
      if (body.length > MAX_BYTES) throw new Error(`File ${id} is too large to pass through`);
    }
    const safeName = file.filename.replace(/[^\w.-]+/g, "_");
    res.setHeader("Content-Type", file.content_type);
    res.setHeader("Content-Length", body.length);
    res.setHeader("Content-Disposition", `attachment; filename="${safeName}"`);
    return res.status(200).send(body);
  } catch (error) {
    console.error("Portal file error:", error);
    return res.status(500).send("We couldn't load that file right now. Please try again.");
  }
}
