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

// Ways a business can be reached, in the order the review page shows them
export const OUTREACH_METHODS = [
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone call" },
  { key: "form", label: "Contact form" },
];

export function methodLabel(key) {
  return OUTREACH_METHODS.find((item) => item.key === key)?.label ?? key;
}
