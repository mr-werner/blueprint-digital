import { useRef, useState } from "react";
import { FieldControl } from "./fields.jsx";
import { HOME_ID, newId, newSection, slugify } from "./layout.js";

function updatePage(layout, pageId, change) {
  return { ...layout, pages: layout.pages.map((p) => (p.id === pageId ? { ...p, ...change(p) } : p)) };
}

function sectionLabel(section, schema) {
  if (section.type === "builtin") return schema.builtins.find((b) => b.id === section.id)?.label || section.id;
  const type = schema.sectionTypes.find((t) => t.type === section.type);
  const title = section.title || section.items?.[0]?.caption || "";
  return title ? `${type?.label}: ${title}` : type?.label || section.type;
}

function shown(field, values) {
  if (!field.showIf) return true;
  const [key, wanted] = field.showIf;
  return values[key] === wanted;
}

function AddSectionPicker({ schema, onAdd, onClose }) {
  return (
    <div className="ed-picker" role="dialog" aria-label="Add a section">
      <div className="ed-drawer-head">
        <h3>Add a section</h3>
        <button type="button" className="ed-link-button" onClick={onClose}>
          Cancel
        </button>
      </div>
      <div className="ed-picker-grid">
        {schema.sectionTypes.map((t) => (
          <button key={t.type} type="button" className="ed-picker-option" onClick={() => onAdd(t.type)}>
            <strong>{t.label}</strong>
            <span>{t.description}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function SectionsPanel({ schema, layout, page, selectedSection, selectedField, onSelectSection, onLayout, renderGroup, send }) {
  const [picking, setPicking] = useState(false);
  const dragFrom = useRef(null);
  const sections = page.sections;

  const setSections = (next) => onLayout(updatePage(layout, page.id, () => ({ sections: next })));

  function move(from, to) {
    if (to < 0 || to >= sections.length || from === to) return;
    const next = [...sections];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    setSections(next);
  }

  function toggleHidden(index) {
    setSections(sections.map((s, i) => (i === index ? { ...s, hidden: !s.hidden } : s)));
  }

  function remove(index) {
    if (!window.confirm("Delete this section? You can undo this, or get it back from History.")) return;
    setSections(sections.filter((_, i) => i !== index));
    onSelectSection("");
  }

  function add(type) {
    const section = newSection(type, schema);
    const at = sections.findIndex((s) => s.id === selectedSection);
    const next = [...sections];
    next.splice(at === -1 ? next.length : at + 1, 0, section);
    setSections(next);
    setPicking(false);
    onSelectSection(section.id);
  }

  function updateSection(id, key, value) {
    setSections(sections.map((s) => (s.id === id ? { ...s, [key]: value } : s)));
  }

  return (
    <div className="ed-sections">
      <p className="ed-tip">
        {page.id === HOME_ID
          ? "Show, hide, move or add sections. Your designed sections can be hidden but not deleted."
          : "Add sections to build this page. The header, footer, colors and fonts come from your site."}
      </p>
      <ol className="ed-section-list">
        {sections.map((section, index) => {
          const open = selectedSection === section.id;
          const builtin = section.type === "builtin";
          const type = builtin ? null : schema.sectionTypes.find((t) => t.type === section.type);
          const group = builtin ? schema.builtins.find((b) => b.id === section.id)?.group : null;
          return (
            <li
              key={section.id}
              className={`ed-section-row${open ? " is-open" : ""}${section.hidden ? " is-hidden" : ""}`}
              draggable
              onDragStart={() => {
                dragFrom.current = index;
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (dragFrom.current !== null) move(dragFrom.current, index);
                dragFrom.current = null;
              }}
            >
              <div className="ed-section-head">
                <span className="ed-grip" aria-hidden="true">
                  ⋮⋮
                </span>
                <button type="button" className="ed-section-title" onClick={() => onSelectSection(open ? "" : section.id)} aria-expanded={open}>
                  {sectionLabel(section, schema)}
                  {section.hidden && <em> · hidden</em>}
                </button>
                <button type="button" className="ed-mini" onClick={() => move(index, index - 1)} disabled={index === 0} aria-label="Move up">
                  ↑
                </button>
                <button type="button" className="ed-mini" onClick={() => move(index, index + 1)} disabled={index === sections.length - 1} aria-label="Move down">
                  ↓
                </button>
                <button type="button" className="ed-mini" onClick={() => toggleHidden(index)} aria-label={section.hidden ? "Show section" : "Hide section"} title={section.hidden ? "Show" : "Hide"}>
                  {section.hidden ? "Show" : "Hide"}
                </button>
                {!builtin && (
                  <button type="button" className="ed-mini ed-mini-danger" onClick={() => remove(index)} aria-label="Delete section">
                    ✕
                  </button>
                )}
              </div>
              {open && builtin && group && <div className="ed-section-body">{renderGroup(group)}</div>}
              {open && type && (
                <div className="ed-section-body">
                  {type.fields.map((field) => (
                    <FieldControl
                      key={field.key}
                      field={field}
                      idPrefix={section.id}
                      value={section[field.key] ?? field.default}
                      selected={selectedField === field.key}
                      onChange={(v) => updateSection(section.id, field.key, v)}
                      onFocus={() => send({ type: "focus", key: `section:${section.id}.${field.key}` })}
                    />
                  ))}
                  <details className="ed-style">
                    <summary>Background and spacing</summary>
                    {schema.styleFields
                      .filter((field) => shown(field, section))
                      .map((field) => (
                        <FieldControl
                          key={field.key}
                          field={field}
                          idPrefix={section.id}
                          value={section[field.key] ?? field.default}
                          onChange={(v) => updateSection(section.id, field.key, v)}
                        />
                      ))}
                  </details>
                </div>
              )}
            </li>
          );
        })}
      </ol>
      {picking ? (
        <AddSectionPicker schema={schema} onAdd={add} onClose={() => setPicking(false)} />
      ) : (
        <button type="button" className="ed-add ed-add-section" onClick={() => setPicking(true)}>
          + Add section{selectedSection ? " below the open one" : ""}
        </button>
      )}
    </div>
  );
}

export function PagesPanel({ schema, layout, currentPageId, onLayout, onOpenPage }) {
  const [title, setTitle] = useState("");

  function add(event) {
    event.preventDefault();
    const name = title.trim();
    if (!name) return;
    const slug = slugify(name, layout.pages.map((p) => p.slug));
    const first = { ...newSection("text", schema), title: name, eyebrow: "", body: "Introduce this page here." };
    const page = { id: newId("p"), title: name, slug, nav: true, sections: [first] };
    onLayout({ ...layout, pages: [...layout.pages, page] });
    setTitle("");
    onOpenPage(page);
  }

  function update(id, change) {
    onLayout(updatePage(layout, id, () => change));
  }

  function remove(page) {
    if (!window.confirm(`Delete the "${page.title}" page? You can undo this, or get it back from History.`)) return;
    onLayout({ ...layout, pages: layout.pages.filter((p) => p.id !== page.id) });
    if (page.id === currentPageId) onOpenPage(layout.pages[0]);
  }

  function move(index, by) {
    const pages = [...layout.pages];
    const [page] = pages.splice(index, 1);
    pages.splice(index + by, 0, page);
    onLayout({ ...layout, pages });
  }

  return (
    <div className="ed-pages">
      <p className="ed-tip">Every page uses your header, footer, colors and fonts. Pages marked "In menu" show up in the header menu; all pages are linked in the footer.</p>
      <ul className="ed-page-list">
        {layout.pages.map((page, index) => (
          <li key={page.id} className={page.id === currentPageId ? "is-current" : ""}>
            {page.id === HOME_ID ? (
              <div className="ed-page-row">
                <strong>Home</strong>
                <span className="ed-muted">/</span>
                <button type="button" className="ed-button ed-button-small" onClick={() => onOpenPage(page)}>
                  Edit
                </button>
              </div>
            ) : (
              <>
                <div className="ed-page-row">
                  <input
                    className="ed-page-title"
                    value={page.title}
                    maxLength={60}
                    onChange={(e) => update(page.id, { title: e.target.value })}
                    aria-label="Page name"
                  />
                  <button type="button" className="ed-button ed-button-small" onClick={() => onOpenPage(page)}>
                    Edit
                  </button>
                </div>
                <div className="ed-page-meta">
                  <label className="ed-muted">
                    /
                    <input
                      className="ed-page-slug"
                      value={page.slug}
                      maxLength={40}
                      onChange={(e) => update(page.id, { slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })}
                      onBlur={(e) => update(page.id, { slug: slugify(e.target.value, layout.pages.filter((p) => p.id !== page.id).map((p) => p.slug)) })}
                      aria-label="Page address"
                    />
                  </label>
                  <label className="ed-check">
                    <input type="checkbox" checked={page.nav} onChange={(e) => update(page.id, { nav: e.target.checked })} /> In menu
                  </label>
                  <button type="button" className="ed-mini" onClick={() => move(index, -1)} disabled={index <= 1} aria-label="Move up">
                    ↑
                  </button>
                  <button type="button" className="ed-mini" onClick={() => move(index, 1)} disabled={index === layout.pages.length - 1} aria-label="Move down">
                    ↓
                  </button>
                  <button type="button" className="ed-mini ed-mini-danger" onClick={() => remove(page)} aria-label={`Delete ${page.title}`}>
                    ✕
                  </button>
                </div>
              </>
            )}
          </li>
        ))}
      </ul>
      <form className="ed-add-page" onSubmit={add}>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="New page name, e.g. Gallery" maxLength={60} aria-label="New page name" />
        <button type="submit" className="ed-button ed-button-small" disabled={!title.trim()}>
          Add page
        </button>
      </form>
    </div>
  );
}
