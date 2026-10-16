export function hostOf(url) {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function formatDate(value) {
  if (!value) return null;
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// Same rule the server uses: bracketed lowercase phrases such as
// "[studio mailing address]" are unfinished placeholders in a draft.
export const PLACEHOLDER_PATTERN = /\[(?:[a-z]+ )+[a-z]+\]/;
