import { createHash } from "node:crypto";
import { neon } from "@neondatabase/serverless";

// Records one page view for a client site, sent by a small beacon script on
// that site. Visitors are counted by a daily hash of IP and browser, so no
// cookie is set and nobody can be followed from one day to the next.
// Studio subdomains are matched on demos.demo_url; a client's own domain
// (for example a WordPress site running our theme) is listed in site_domains.
const ORIGIN_PATTERN = /^https:\/\/[a-z0-9-]+\.blueprintwebstudio\.com$/;
const ANY_HTTPS_ORIGIN = /^https:\/\/[a-z0-9.-]+$/i;

function hostOf(url) {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export default async function handler(req, res) {
  const origin = req.headers.origin || "";

  if (ANY_HTTPS_ORIGIN.test(origin)) {
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

  // Only client sites are counted; anything else is ignored quietly
  if (!ANY_HTTPS_ORIGIN.test(origin)) return res.status(204).end();

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
    if (ORIGIN_PATTERN.test(origin)) {
      await sql`
        INSERT INTO site_visits (demo_id, path, referrer, visitor, device)
        SELECT id, ${path}, ${referrer}, ${visitor}, ${device}
        FROM demos
        WHERE rtrim(demo_url, '/') = ${origin}
          AND status = 'active'
          AND portal_enabled = true
        LIMIT 1
      `;
    } else {
      await sql`
        INSERT INTO site_visits (demo_id, path, referrer, visitor, device)
        SELECT d.id, ${path}, ${referrer}, ${visitor}, ${device}
        FROM site_domains sd
        JOIN demos d ON d.id = sd.demo_id
        WHERE sd.host = ${ownHost.toLowerCase().replace(/^www\./, "")}
          AND d.status = 'active'
          AND d.portal_enabled = true
        LIMIT 1
      `;
    }
  } catch (error) {
    console.error("Visit tracking error:", error);
  }

  return res.status(204).end();
}
