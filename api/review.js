import { neon } from "@neondatabase/serverless";

export default async function handler(req, res) {
  // Never cache this response; it is only for the studio owner
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");

  // Only allow POST requests
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");

    return res.status(405).json({
      success: false,
      message: "Method not allowed.",
    });
  }

  try {
    const { code } = req.body ?? {};

    // Make sure a review code was provided
    if (!code || typeof code !== "string" || !code.trim()) {
      return res.status(400).json({
        success: false,
        message: "Please enter your review code.",
      });
    }

    // Normalize the code so capitalization doesn't matter
    const normalizedCode = code.trim().toUpperCase();

    // Get the Neon connection string from Vercel
    const connectionString = process.env.BLUEPRINT_DB_DATABASE_URL;

    if (!connectionString) {
      console.error("Missing BLUEPRINT_DB_DATABASE_URL environment variable.");

      return res.status(500).json({
        success: false,
        message: "The review page is temporarily unavailable.",
      });
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
      return res.status(401).json({
        success: false,
        message: "That review code isn't valid.",
      });
    }

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
        view_count
      FROM demos
      WHERE is_admin = false
      ORDER BY created_at DESC, id DESC
    `;

    return res.status(200).json({
      success: true,
      demos,
    });
  } catch (error) {
    console.error("Review lookup error:", error);

    return res.status(500).json({
      success: false,
      message: "We couldn't load the review page right now. Please try again.",
    });
  }
}
