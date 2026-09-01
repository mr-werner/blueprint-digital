export default async function handler(req, res) {
  const allowedOrigins = [
    "https://ace.blueprintwebstudio.com",
  ];

  const origin = req.headers.origin;

  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }

  res.setHeader(
    "Access-Control-Allow-Methods",
    "POST, OPTIONS"
  );

  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type"
  );

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      message: "Method not allowed",
    });
  }

  try {
    const {
      prospect,
      source,
      page,
      action,
      name,
      email,
      phone,
      budget,
      message,
    } = req.body || {};

    if (!prospect || !source || !name || !email || !budget) {
      return res.status(400).json({
        success: false,
        message: "Missing required information",
      });
    }

    const resendResponse = await fetch(
      "https://api.resend.com/emails",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Blueprint WebStudio <website@blueprintwebstudio.com>",
          to: ["hello@blueprintwebstudio.com"],
          subject: `NEW PARTNER LEAD — ${prospect}`,
          html: `
            <div style="font-family: Arial, Helvetica, sans-serif; color: #222222; line-height: 1.6;">
              <h2 style="margin-bottom: 6px;">
                New Partner Program Lead
              </h2>

              <p style="color: #666666; margin-top: 0;">
                A prospect submitted the interest form from a
                Blueprint WebStudio private concept preview.
              </p>

              <hr style="border: 0; border-top: 1px solid #dddddd; margin: 24px 0;" />

              <h3>Contact Information</h3>

              <p>
                <strong>Name:</strong><br />
                ${escapeHtml(name)}
              </p>

              <p>
                <strong>Email:</strong><br />
                <a href="mailto:${escapeHtml(email)}">
                  ${escapeHtml(email)}
                </a>
              </p>

              <p>
                <strong>Phone:</strong><br />
                ${phone ? escapeHtml(phone) : "Not provided"}
              </p>

              <p>
                <strong>Budget:</strong><br />
                ${escapeHtml(budget)}
              </p>

              <p>
                <strong>Message:</strong><br />
                ${
                  message
                    ? escapeHtml(message).replaceAll("\n", "<br />")
                    : "No message provided"
                }
              </p>

              <hr style="border: 0; border-top: 1px solid #dddddd; margin: 24px 0;" />

              <h3>Concept Information</h3>

              <p>
                <strong>Prospect:</strong><br />
                ${escapeHtml(prospect)}
              </p>

              <p>
                <strong>Source:</strong><br />
                ${escapeHtml(source)}
              </p>

              <p>
                <strong>Action:</strong><br />
                ${escapeHtml(action || "Partner Program Interest")}
              </p>

              <p>
                <strong>Preview Page:</strong><br />
                ${
                  page
                    ? `<a href="${escapeHtml(page)}">${escapeHtml(page)}</a>`
                    : "Unknown"
                }
              </p>

              <p>
                <strong>Submitted:</strong><br />
                ${new Date().toISOString()}
              </p>
            </div>
          `,
        }),
      }
    );

    const resendData = await resendResponse.json();

    if (!resendResponse.ok) {
      console.error("Resend error:", resendData);

      return res.status(500).json({
        success: false,
        message: "Email could not be sent",
      });
    }

    return res.status(200).json({
      success: true,
    });
  } catch (error) {
    console.error("Demo interest error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}