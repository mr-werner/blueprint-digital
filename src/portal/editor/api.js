export async function callEditor(payload) {
  try {
    const response = await fetch("/api/site-editor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.success) {
      return { error: data.message || "Something went wrong. Please try again.", status: response.status };
    }
    return { data };
  } catch {
    return { error: "We couldn't reach the editor. Check your connection and try again." };
  }
}
