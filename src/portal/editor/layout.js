// Layout helpers. A layout is { pages: [{ id, title, slug, nav, sections: [...] }] };
// sections are the site's designed ones ({ id, type: "builtin", hidden }) or added
// ones ({ id, type, hidden, ...their fields }).

export const HOME_ID = "home";

export function newId(prefix) {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function slugify(text, taken) {
  const base =
    String(text)
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "page";
  let slug = base;
  for (let n = 2; taken.includes(slug); n += 1) slug = `${base}-${n}`;
  return slug;
}

export function newSection(type, schema, id = newId("s")) {
  const def = schema.sectionTypes.find((t) => t.type === type);
  const section = { id, type, hidden: false };
  for (const field of [...schema.styleFields, ...def.fields]) section[field.key] = field.default;
  return { ...section, ...(def.defaults || {}) };
}
