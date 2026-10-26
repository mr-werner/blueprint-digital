import { createHash } from "node:crypto";
import { neon } from "@neondatabase/serverless";

// Records one page view for a client site, sent by a small beacon script on
// that site. Visitors are counted by a daily hash of IP and browser, so no
// cookie is set and nobody can be followed from one day to the next.
const ORIGIN_PATTERN = /^https:\/\/[a-z0-9-]+\.blueprintwebstudio\.com$/;

function hostOf(url) {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export default async function handler(req, res) {
  const origin = req.headers.origin || "";

  if (ORIGIN_PATTERN.test(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).end();
  }

  // Only client subdomains are counted; anything else is ignored quietly
  if (!ORIGIN_PATTERN.test(origin)) return res.status(204).end();

  const userAgent = String(req.headers["user-agent"] || "");
  if (/bot|crawl|spider|preview|headless|lighthouse/i.test(userAgent)) {
    return res.status(204).end();
  }

  const connectionString = process.env.BLUEPRINT_DB_DATABASE_URL;
  if (!connectionString) return res.status(204).end();

  try {
    // sendBeacon posts text/plain, so the body may arrive as a string
    let payload = req.body ?? {};
    if (typeof payload === "string") {
      try {
        payload = JSON.parse(payload);
      } catch {
        payload = {};
      }
    }

    const path = String(payload.path || "/").slice(0, 300);
    const referrerHost = hostOf(payload.referrer || "");
    const ownHost = new URL(origin).host;
    const referrer = referrerHost && referrerHost !== ownHost ? referrerHost : "";

    const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
    const day = new Date().toISOString().slice(0, 10);
    const visitor = createHash("sha256")
      .update(`${day}|${ip}|${userAgent}`)
      .digest("hex")
      .slice(0, 24);
    const device = /mobi|iphone|android/i.test(userAgent) ? "mobile" : "desktop";

    const sql = neon(connectionString);
    await sql`
      INSERT INTO site_visits (demo_id, path, referrer, visitor, device)
      SELECT id, ${path}, ${referrer}, ${visitor}, ${device}
      FROM demos
      WHERE rtrim(demo_url, '/') = ${origin}
        AND status = 'active'
        AND portal_enabled = true
      LIMIT 1
    `;
  } catch (error) {
    console.error("Visit tracking error:", error);
  }

  return res.status(204).end();
}
