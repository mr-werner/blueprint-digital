import { Buffer } from "node:buffer";
import { neon } from "@neondatabase/serverless";

// Screenshots and logos for the /review page. Images come from Microlink
// (free tier: 50 requests a day, or set MICROLINK_API_KEY for more) and are
// cached on Vercel's CDN for a week, so each site is only captured once.
const CACHE_HIT = "public, max-age=3600, s-maxage=604800, stale-while-revalidate=86400";
const CACHE_MISS = "public, max-age=60, s-maxage=600";

function microlinkUrl(target, kind) {
  const base = process.env.MICROLINK_API_KEY
    ? "https://pro.microlink.io/"
    : "https://api.microlink.io/";
  const params = new URLSearchParams({ url: target });

  if (kind === "logo") {
    params.set("palette", "false");
  } else {
    params.set("screenshot", "true");
    params.set("meta", "false");
    params.set("viewport.width", "1280");
    params.set("viewport.height", "800");
    params.set("waitForTimeout", "1500");
  }

  return `${base}?${params}`;
}

function notFound(res) {
  res.setHeader("Cache-Control", CACHE_MISS);
  return res.status(404).end();
}

export default async function handler(req, res) {
  res.setHeader("X-Robots-Tag", "noindex, nofollow");

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).end();
  }

  const { code, id, kind } = req.query;
  const demoId = Number(id);

  if (
    typeof code !== "string" ||
    !Number.isSafeInteger(demoId) ||
    !["concept", "original", "logo"].includes(kind)
  ) {
    return res.status(400).end();
  }

  const connectionString = process.env.BLUEPRINT_DB_DATABASE_URL;
  if (!connectionString) return res.status(500).end();

  try {
    const sql = neon(connectionString);

    // Only screenshot sites that belong to a demo, and only for the review code
    const rows = await sql`
      SELECT d.demo_url, d.original_url
      FROM demos d
      WHERE d.id = ${demoId}
        AND d.is_admin = false
        AND EXISTS (
          SELECT 1 FROM demos a
          WHERE a.is_admin = true
            AND a.status = 'active'
            AND UPPER(a.demo_code) = ${code.trim().toUpperCase()}
        )
    `;

    if (rows.length === 0) {
      res.setHeader("Cache-Control", "no-store");
      return res.status(404).end();
    }

    const target = kind === "concept" ? rows[0].demo_url : rows[0].original_url;
    if (!target) return notFound(res);

    const headers = process.env.MICROLINK_API_KEY
      ? { "x-api-key": process.env.MICROLINK_API_KEY }
      : {};
    const lookup = await fetch(microlinkUrl(target, kind), { headers });
    const result = await lookup.json().catch(() => null);
    const imageUrl =
      kind === "logo" ? result?.data?.logo?.url : result?.data?.screenshot?.url;

    if (!lookup.ok || result?.status !== "success" || !imageUrl) {
      console.error("Microlink lookup failed:", lookup.status, result?.message);
      return notFound(res);
    }

    const image = await fetch(imageUrl);
    const type = image.headers.get("content-type") || "";
    if (!image.ok || !type.startsWith("image/")) return notFound(res);

    res.setHeader("Content-Type", type);
    res.setHeader("Cache-Control", CACHE_HIT);
    return res.status(200).send(Buffer.from(await image.arrayBuffer()));
  } catch (error) {
    console.error("Review screenshot error:", error);
    return notFound(res);
  }
}
