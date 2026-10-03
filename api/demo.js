import { neon } from "@neondatabase/serverless";

export default async function handler(req, res) {
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

    // Make sure a demo code was provided
    if (!code || typeof code !== "string" || !code.trim()) {
      return res.status(400).json({
        success: false,
        message: "Please enter your demo code.",
      });
    }

    // Normalize the code so capitalization doesn't matter
    const normalizedCode = code.trim().toUpperCase();

    // Get the Neon connection string from Vercel
    const connectionString =
      process.env.BLUEPRINT_DB_DATABASE_URL;

    if (!connectionString) {
      console.error(
        "Missing BLUEPRINT_DB_DATABASE_URL environment variable."
      );

      return res.status(500).json({
        success: false,
        message: "The demo service is temporarily unavailable.",
      });
    }

    // Connect to Neon
    const sql = neon(connectionString);

    // Look for an active demo matching the submitted code
    const demos = await sql`
      SELECT
        id,
        business_name,
        demo_url
      FROM demos
      WHERE UPPER(demo_code) = ${normalizedCode}
        AND status = 'active'
      LIMIT 1
    `;

    // No matching demo code
    if (demos.length === 0) {
      return res.status(404).json({
        success: false,
        message:
          "We couldn't find that demo code. Please check your code and try again.",
      });
    }

    const demo = demos[0];

    // Record that the demo was viewed
    await sql`
      UPDATE demos
      SET
        first_viewed_at = COALESCE(first_viewed_at, NOW()),
        last_viewed_at = NOW(),
        view_count = view_count + 1
      WHERE id = ${demo.id}
    `;

    // Return the destination URL to the React frontend
    return res.status(200).json({
      success: true,
      destination: demo.demo_url,
    });
  } catch (error) {
    console.error("Demo lookup error:", error);

    return res.status(500).json({
      success: false,
      message:
        "We couldn't access your demo right now. Please try again.",
    });
  }
}