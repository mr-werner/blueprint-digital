export default async function handler(req, res) {

    const allowedOrigins = [
        "https://ace.blueprintwebstudio.com",
    ];

    const origin = req.headers.origin;

    if (origin && allowedOrigins.includes(origin)) {
        res.setHeader(
            "Access-Control-Allow-Origin",
            origin
        );
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
        } = req.body || {};

        if (!prospect || !source) {
            return res.status(400).json({
                success: false,
                message: "Missing prospect information",
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
                    subject: `Demo Interest: ${prospect}`,
                    html: `
            <h2>Demo Website Interest</h2>

            <p>
              A prospect clicked the interest button on a
              Blueprint WebStudio concept preview.
            </p>

            <p>
              <strong>Prospect:</strong> ${escapeHtml(prospect)}
            </p>

            <p>
              <strong>Source:</strong> ${escapeHtml(source)}
            </p>

            <p>
              <strong>Action:</strong>
              ${escapeHtml(action || "Partner Program Interest")}
            </p>

            <p>
              <strong>Page:</strong>
              ${escapeHtml(page || "Unknown")}
            </p>

            <p>
              <strong>Submitted:</strong>
              ${new Date().toISOString()}
            </p>
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