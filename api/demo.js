export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      message: "Method not allowed",
    });
  }

  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({
        success: false,
        message: "Demo code is required.",
      });
    }

    const normalizedCode = code.trim().toUpperCase();

    const demoSites = {
      ACE: "https://ace.blueprintwebstudio.com",
      NCTS: "https://ncts.blueprintwebstudio.com"
    };

    const destination = demoSites[normalizedCode];

    if (!destination) {
      return res.status(404).json({
        success: false,
        message: "We couldn't find that demo code.",
      });
    }

    return res.status(200).json({
      success: true,
      destination,
    });
  } catch (error) {
    console.error("Demo code error:", error);

    return res.status(500).json({
      success: false,
      message: "Something went wrong. Please try again.",
    });
  }
}