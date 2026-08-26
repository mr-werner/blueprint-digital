import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({
            error: "Method not allowed",
        });
    }

    try {
        const {
            name,
            companyName,
            email,
            phone,
            companyType,
            budget,
            project,
            turnstileToken,
        } = req.body;

        if (
            !name ||
            !companyName ||
            !email ||
            !companyType ||
            !budget ||
            !project ||
            !turnstileToken
        ) {
            return res.status(400).json({
                error: "Please complete all required fields.",
            });
        }

        const turnstileResponse = await fetch(
            "https://challenges.cloudflare.com/turnstile/v0/siteverify",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                body: new URLSearchParams({
                    secret: process.env.TURNSTILE_SECRET_KEY,
                    response: turnstileToken,
                }),
            }
        );

        const turnstileResult = await turnstileResponse.json();

        if (!turnstileResult.success) {
            console.error("Turnstile verification failed:", turnstileResult);

            return res.status(403).json({
                error: "Security verification failed. Please try again.",
            });
        }

        const { data, error } = await resend.emails.send({
            from: "Blueprint WebStudio <website@blueprintwebstudio.com>",

            to: ["hello@blueprintwebstudio.com"],

            replyTo: email,

            subject: `New Blueprint WebStudio inquiry — ${companyName}`,

            html: `
        <div style="font-family: Arial, sans-serif; max-width: 650px; margin: auto;">
          
          <h2>New Website Inquiry</h2>

          <hr />

          <p>
            <strong>Name:</strong><br />
            ${name}
          </p>

          <p>
            <strong>Company:</strong><br />
            ${companyName}
          </p>

          <p>
            <strong>Email:</strong><br />
            ${email}
          </p>

          <p>
            <strong>Phone:</strong><br />
            ${phone || "Not provided"}
          </p>

          <p>
            <strong>Company Type:</strong><br />
            ${companyType}
          </p>

          <p>
            <strong>Budget:</strong><br />
            ${budget}
          </p>

          <hr />

          <p>
            <strong>Project Details:</strong>
          </p>

          <p style="white-space: pre-wrap;">
            ${project}
          </p>

        </div>
      `,
        });

        if (error) {
            console.error("Resend error:", error);

            return res.status(500).json({
                error: "Unable to send email.",
            });
        }

        return res.status(200).json({
            success: true,
            data,
        });
    } catch (error) {
        console.error("Contact form error:", error);

        return res.status(500).json({
            error: "Something went wrong.",
        });
    }
}