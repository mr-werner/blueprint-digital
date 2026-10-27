export async function callAdmin(payload) {
  try {
    const response = await fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.success) {
      return {
        error: data.message || "Something went wrong. Please try again.",
        signedOut: response.status === 401 && !["signin", "setup"].includes(payload.action),
      };
    }
    return { data };
  } catch {
    return { error: "We couldn't reach the dashboard. Check your connection and try again." };
  }
}

export const CONTRACT_LABELS = {
  draft: "Draft",
  sent: "Sent to client",
  signed: "Signed",
  in_progress: "In progress",
  complete: "Complete",
  cancelled: "Cancelled",
};

export const MILESTONE_LABELS = { planned: "Upcoming", in_progress: "In progress", done: "Done" };

export function money(cents) {
  return (Number(cents) / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export function formatDate(value) {
  if (!value) return "";
  // Plain dates ("2026-10-26") are calendar days, not moments in UTC
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : new Date(value);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function projectTotal(contract) {
  return (contract.cost_items || []).reduce((total, item) => total + item.amount_cents, 0);
}

export function deliveryCount(contract) {
  const all = (contract?.timeline ?? []).flatMap((step) => step.deliverables);
  return { done: all.filter((entry) => entry.done).length, total: all.length };
}

export function fileSize(bytes) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
