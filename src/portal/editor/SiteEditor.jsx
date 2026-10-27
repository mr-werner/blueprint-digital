import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { callEditor } from "./api.js";
import { FieldControl } from "./fields.jsx";
import { HOME_ID } from "./layout.js";
import { PagesPanel, SectionsPanel } from "./panels.jsx";

// The client site editor. The client's own site runs in the preview frame with ?bws-edit=1;
// it tells us which fields, designed sections and section types it has (the "ready" message),
// we send it the edits as they change, and it tells us when an element is clicked, dragged
// to a new size, or the preview moves to another page.
// Edits are overrides only: a field missing from `edits` shows the site's built-in content.
// The `layout` edit holds the pages and their sections.

const MESSAGE_SOURCE = "bws-editor";
const AUTOSAVE_MS = 1200;
const READY_TIMEOUT_MS = 15000;
const DEVICES = [
  { id: "desktop", label: "Desktop", width: 1280 },
  { id: "tablet", label: "Tablet", width: 820 },
  { id: "phone", label: "Phone", width: 390 },
];
const TABS = [
  ["sections", "Sections"],
  ["content", "Site-wide"],
  ["pages", "Pages"],
];

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function originOf(url) {
  try {
    return new URL(url).origin;
  } catch {
    return "";
  }
}

function sameEdits(a, b) {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) if (!same(a[key], b[key])) return false;
  return true;
}

function timeAgo(value) {
  if (!value) return "";
  const date = new Date(value);
  const minutes = Math.round((Date.now() - date.getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  return date.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function History({ versions, onRestore, onClose }) {
  return (
    <div className="ed-drawer" role="dialog" aria-label="Publish history">
      <div className="ed-drawer-head">
        <h2>History</h2>
        <button type="button" className="ed-link-button" onClick={onClose}>
          Close
        </button>
      </div>
      <p className="ed-help">Every publish is saved. Load one to review it in the preview, then publish it to put it back on your site.</p>
      {versions.length === 0 && <p className="ed-empty">Nothing published yet.</p>}
      <ul>
        {versions.map((v, i) => (
          <li key={v.id}>
            <div>
              <strong>{i === 0 ? "Live now" : timeAgo(v.createdAt)}</strong>
              <span>
                {v.author || "Studio"} · {v.edits} {v.edits === 1 ? "edit" : "edits"}
                {i === 0 ? ` · ${timeAgo(v.createdAt)}` : ""}
              </span>
            </div>
            <button type="button" className="ed-button ed-button-small" onClick={() => onRestore(v.id)}>
              Load
            </button>
          </li>
        ))}
        <li>
          <div>
            <strong>Original design</strong>
            <span>The site as Blueprint WebStudio built it</span>
          </div>
          <button type="button" className="ed-button ed-button-small" onClick={() => onRestore(0)}>
            Load
          </button>
        </li>
      </ul>
    </div>
  );
}

// Edits plus undo/redo. Rapid changes to one field (typing, dragging a slider)
// are grouped into a single undo step.
const EMPTY_HISTORY = { edits: {}, past: [], future: [], lastKey: "", lastAt: 0 };

function historyReducer(history, action) {
  if (action.type === "replace") return { ...EMPTY_HISTORY, past: history.past, edits: action.edits };
  if (action.type === "undo") {
    if (history.past.length === 0) return history;
    return { ...history, edits: history.past.at(-1), past: history.past.slice(0, -1), future: [history.edits, ...history.future], lastKey: "" };
  }
  if (action.type === "redo") {
    if (history.future.length === 0) return history;
    return { ...history, edits: history.future[0], past: [...history.past, history.edits], future: history.future.slice(1), lastKey: "" };
  }

  // "set" one field (value undefined removes it), or "load" a whole set of edits
  let next;
  if (action.type === "set") {
    next = { ...history.edits };
    if (action.value === undefined) delete next[action.key];
    else next[action.key] = action.value;
  } else {
    next = action.edits;
  }
  if (sameEdits(next, history.edits)) return history;
  const key = action.group || action.key || "";
  const at = key ? Date.now() : 0;
  const grouped = key && history.lastKey === key && at - history.lastAt < 1500;
  return {
    edits: next,
    past: grouped ? history.past : [...history.past.slice(-99), history.edits],
    future: [],
    lastKey: key,
    lastAt: at,
  };
}

// Clamps a value to what the field allows; undefined means "back to the original"
function normalize(field, value) {
  if (field.type === "size") {
    const number = Number(value);
    if (!Number.isFinite(number)) return null;
    const step = field.step || 1;
    value = Math.min(field.max, Math.max(field.min, Math.round(number / step) * step));
  } else if (field.type === "list") {
    if (!Array.isArray(value)) return null;
  } else {
    value = String(value ?? "");
  }
  return same(value, field.default) ? undefined : value;
}

export default function SiteEditor() {
  const [state, setState] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [schema, setSchema] = useState(null);
  const [frameProblem, setFrameProblem] = useState(false);
  const [history, dispatch] = useReducer(historyReducer, EMPTY_HISTORY);
  const [saveState, setSaveState] = useState("saved");
  const [notice, setNotice] = useState("");
  const [device, setDevice] = useState("desktop");
  const [tab, setTab] = useState("sections");
  const [pageId, setPageId] = useState(HOME_ID);
  const [openGroup, setOpenGroup] = useState("");
  const [selected, setSelected] = useState("");
  const [selectedSection, setSelectedSection] = useState("");
  const [selectedSectionField, setSelectedSectionField] = useState("");
  const [query, setQuery] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [stageWidth, setStageWidth] = useState(1000);
  const [saved, setSaved] = useState({});
  const frameRef = useRef(null);
  const stageRef = useRef(null);

  const { edits, past, future } = history;
  const siteOrigin = state ? originOf(state.site.url) : "";
  const published = state?.published ?? {};
  const fields = schema?.fields;
  const fieldMap = useMemo(() => Object.fromEntries((fields || []).map((f) => [f.key, f])), [fields]);
  const builtinGroups = useMemo(() => new Map((schema?.builtins || []).map((b) => [b.group, b.id])), [schema]);
  const layout = edits.layout ?? schema?.defaultLayout;
  const page = layout?.pages.find((p) => p.id === pageId) || layout?.pages[0];

  useEffect(() => {
    callEditor({ action: "load" }).then((result) => {
      if (result.status === 401) {
        window.location.replace("/portal/");
        return;
      }
      if (result.error) return setLoadError(result.error);
      const start = result.data.draft ?? result.data.published ?? {};
      setSaved(start);
      dispatch({ type: "replace", edits: start });
      setState(result.data);
    });
  }, []);

  const send = useCallback(
    (message) => {
      frameRef.current?.contentWindow?.postMessage({ source: MESSAGE_SOURCE, ...message }, siteOrigin);
    },
    [siteOrigin]
  );

  // A click in the preview: a designed section's field opens that section on the
  // Sections tab, a site-wide field opens the Site-wide tab, an added section opens itself
  const selectKey = useCallback(
    (key) => {
      setQuery("");
      const sectionMatch = /^section:([^.]+)(?:\.(.+))?$/.exec(key);
      if (sectionMatch) {
        setTab("sections");
        setSelectedSection(sectionMatch[1]);
        setSelectedSectionField(sectionMatch[2] || "");
        setSelected("");
        return;
      }
      const field = fieldMap[key];
      if (!field) return;
      const builtin = builtinGroups.get(field.group);
      setSelected(key);
      if (builtin) {
        setTab("sections");
        setSelectedSection(builtin);
      } else {
        setTab("content");
        setOpenGroup(field.group);
      }
    },
    [fieldMap, builtinGroups]
  );

  // Messages from the site in the preview frame
  useEffect(() => {
    if (!siteOrigin) return undefined;
    function onMessage(event) {
      if (event.origin !== siteOrigin || event.data?.source !== MESSAGE_SOURCE) return;
      const message = event.data;
      if (message.type === "ready" && Array.isArray(message.fields)) {
        setSchema({
          fields: message.fields,
          groups: message.groups || [...new Set(message.fields.map((f) => f.group))],
          builtins: message.builtins || [],
          sectionTypes: message.sectionTypes || [],
          styleFields: message.styleFields || [],
          defaultLayout: message.defaultLayout || { pages: [{ id: HOME_ID, title: "Home", slug: "", nav: false, sections: [] }] },
        });
        setFrameProblem(false);
      } else if (message.type === "select" && typeof message.key === "string") {
        selectKey(message.key);
      } else if (message.type === "page" && typeof message.id === "string") {
        setPageId(message.id);
      } else if (message.type === "change" && fieldMap[message.key]) {
        const value = normalize(fieldMap[message.key], message.value);
        if (value !== null) dispatch({ type: "set", key: message.key, value });
        selectKey(message.key);
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [siteOrigin, fieldMap, selectKey]);

  // Sites that don't answer haven't been set up for the editor yet
  useEffect(() => {
    if (!state || schema) return undefined;
    const timer = setTimeout(() => setFrameProblem(true), READY_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [state, schema]);

  // Keep the preview in step with the edits (and resend once the site says it's ready)
  useEffect(() => {
    if (schema) send({ type: "content", content: edits });
  }, [edits, schema, send]);

  useEffect(() => {
    if (selected && schema) send({ type: "focus", key: selected });
  }, [selected, schema, send]);

  useEffect(() => {
    if (selectedSection && schema) send({ type: "focus", key: `section:${selectedSection}${selectedSectionField ? `.${selectedSectionField}` : ""}` });
  }, [selectedSection, selectedSectionField, schema, send]);

  // Autosave the draft a moment after the last change
  useEffect(() => {
    if (!state || sameEdits(edits, saved)) return undefined;
    const timer = setTimeout(async () => {
      setSaveState("saving");
      const snapshot = edits;
      const result = await callEditor({ action: "saveDraft", content: snapshot });
      if (result.error) {
        setSaveState("error");
        setNotice(result.error);
      } else {
        setSaved(snapshot);
        setSaveState("saved");
      }
    }, AUTOSAVE_MS);
    return () => clearTimeout(timer);
  }, [edits, saved, state]);

  // Fit the chosen device width into the space available
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return undefined;
    const observer = new ResizeObserver(([entry]) => setStageWidth(entry.contentRect.width));
    observer.observe(stage);
    return () => observer.disconnect();
  }, [state]);

  useEffect(() => {
    function onKey(event) {
      const mod = event.metaKey || event.ctrlKey;
      if (!mod || event.key.toLowerCase() !== "z") return;
      if (event.target.closest?.("input[type=text], input[type=url], input[type=email], input[type=tel], input:not([type]), textarea")) return;
      event.preventDefault();
      dispatch({ type: event.shiftKey ? "redo" : "undo" });
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function updateField(field, rawValue) {
    const value = normalize(field, rawValue);
    if (value === null) return;
    dispatch({ type: "set", key: field.key, value });
  }

  // Layout changes are one edit; typing in one section groups into one undo step
  function setLayout(next) {
    dispatch({ type: "set", key: "layout", value: same(next, schema.defaultLayout) ? undefined : next, group: `layout:${selectedSection}` });
  }

  function openPage(target) {
    setPageId(target.id);
    setSelectedSection("");
    setTab("sections");
    send({ type: "page", slug: target.slug });
  }

  async function publish() {
    const count = Object.keys(edits).length;
    const message =
      count === 0
        ? "Publish your site with all edits removed, so it shows the original design?"
        : "Publish these edits? Visitors will see them on your site within a few seconds.";
    if (!window.confirm(message)) return;
    setPublishing(true);
    const result = await callEditor({ action: "publish", content: edits });
    setPublishing(false);
    if (result.error) return setNotice(result.error);
    setSaved(result.data.published);
    dispatch({ type: "replace", edits: result.data.published });
    setState(result.data);
    setSaveState("saved");
    setNotice("Published. Your site is updated.");
  }

  async function discard() {
    if (!window.confirm("Throw away your unpublished edits and go back to what's live?")) return;
    const result = await callEditor({ action: "discardDraft" });
    if (result.error) return setNotice(result.error);
    setSaved(result.data.published);
    dispatch({ type: "load", edits: result.data.published });
    setState(result.data);
  }

  async function restore(versionId) {
    let content = {};
    if (versionId) {
      const result = await callEditor({ action: "version", versionId });
      if (result.error) return setNotice(result.error);
      content = result.data.content;
    }
    dispatch({ type: "load", edits: content });
    setShowHistory(false);
    setNotice("Loaded into the preview. Publish to put it on your site.");
  }

  function renderField(field) {
    return (
      <FieldControl
        key={field.key}
        field={field}
        value={field.key in edits ? edits[field.key] : field.default}
        changed={field.key in edits}
        selected={selected === field.key}
        onChange={(value) => updateField(field, value)}
        onReset={() => dispatch({ type: "set", key: field.key, value: undefined })}
        onFocus={() => send({ type: "focus", key: field.key })}
      />
    );
  }

  if (loadError) {
    return (
      <main className="ed-gate">
        <p>{loadError}</p>
        <a href="/portal/">Back to your dashboard</a>
      </main>
    );
  }
  if (!state) {
    return (
      <main className="ed-gate">
        <p>Loading the editor…</p>
      </main>
    );
  }
  if (!state.site.enabled) {
    return (
      <main className="ed-gate">
        <h1>The site editor isn't turned on yet</h1>
        <p>
          We're getting {state.site.name} ready for the editor. Email <a href="mailto:hello@blueprintwebstudio.com">hello@blueprintwebstudio.com</a> and we'll let you know when it's
          ready. In the meantime you can send a change request from your dashboard.
        </p>
        <a href="/portal/">Back to your dashboard</a>
      </main>
    );
  }

  const unpublished = !sameEdits(edits, published);
  const width = DEVICES.find((d) => d.id === device).width;
  const scale = Math.min(1, stageWidth / width);
  const search = query.trim().toLowerCase();
  const visibleFields = (fields || []).filter((f) => !search || `${f.label} ${f.group} ${f.help || ""}`.toLowerCase().includes(search));
  const dirty = !sameEdits(edits, saved);
  const saveText = { saved: dirty ? "Unsaved" : unpublished ? "Draft saved" : "All edits are live", saving: "Saving…", error: "Not saved" }[saveState];
  // The Site-wide tab lists groups that aren't one designed section's own text
  const siteWideGroups = (schema?.groups || []).filter((g) => search || !builtinGroups.has(g));

  return (
    <div className="ed-shell">
      <header className="ed-bar">
        <a className="ed-back" href="/portal/">
          ← Dashboard
        </a>
        <div className="ed-title">
          <strong>Edit {state.site.name}</strong>
          <span className={`ed-status is-${saveState}`}>{saveText}</span>
        </div>
        {layout && (
          <label className="ed-page-pick">
            <span>Page</span>
            <select value={page.id} onChange={(e) => openPage(layout.pages.find((p) => p.id === e.target.value))}>
              {layout.pages.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="ed-devices" role="group" aria-label="Preview size">
          {DEVICES.map((d) => (
            <button key={d.id} type="button" className={device === d.id ? "is-active" : ""} aria-pressed={device === d.id} onClick={() => setDevice(d.id)}>
              {d.label}
            </button>
          ))}
        </div>
        <div className="ed-actions">
          <button type="button" className="ed-icon-button" onClick={() => dispatch({ type: "undo" })} disabled={past.length === 0} title="Undo (Ctrl+Z)">
            Undo
          </button>
          <button type="button" className="ed-icon-button" onClick={() => dispatch({ type: "redo" })} disabled={future.length === 0} title="Redo (Ctrl+Shift+Z)">
            Redo
          </button>
          <button type="button" className="ed-icon-button" onClick={() => setShowHistory((v) => !v)}>
            History
          </button>
          {state.draft && (
            <button type="button" className="ed-icon-button" onClick={discard}>
              Discard draft
            </button>
          )}
          <button type="button" className="ed-button ed-publish" onClick={publish} disabled={!unpublished || publishing || saveState === "saving"}>
            {publishing ? "Publishing…" : unpublished ? "Publish" : "Published"}
          </button>
        </div>
      </header>

      {notice && (
        <p className="ed-notice" role="status">
          {notice}
          <button type="button" onClick={() => setNotice("")} aria-label="Dismiss">
            ×
          </button>
        </p>
      )}

      <div className="ed-body">
        <aside className="ed-panel" aria-label="Site content">
          {!schema && !frameProblem && <p className="ed-empty">Loading your site's content…</p>}
          {frameProblem && !schema && (
            <p className="ed-error">
              Your site didn't connect to the editor. Try reloading this page. If it keeps happening, email hello@blueprintwebstudio.com.
            </p>
          )}
          {schema && (
            <>
              <div className="ed-tabs" role="tablist">
                {TABS.map(([id, label]) => (
                  <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? "is-active" : ""} onClick={() => setTab(id)}>
                    {label}
                  </button>
                ))}
              </div>

              {tab === "sections" && (
                <SectionsPanel
                  schema={schema}
                  layout={layout}
                  page={page}
                  selectedSection={selectedSection}
                  selectedField={selectedSectionField}
                  onSelectSection={(id) => {
                    setSelectedSection(id);
                    setSelectedSectionField("");
                  }}
                  onLayout={setLayout}
                  renderGroup={(group) => (fields || []).filter((f) => f.group === group).map(renderField)}
                  send={send}
                />
              )}

              {tab === "content" && (
                <>
                  <p className="ed-tip">Colors, sizes, logo, contact details and the header and footer, used on every page. Click anything on your site to jump to it.</p>
                  <input className="ed-search" type="search" placeholder="Find any field…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Find a field" />
                  {siteWideGroups.map((group) => {
                    const list = visibleFields.filter((f) => f.group === group);
                    if (list.length === 0) return null;
                    const changedCount = list.filter((f) => f.key in edits).length;
                    const open = Boolean(search) || openGroup === group;
                    return (
                      <section key={group} className={`ed-group${open ? " is-open" : ""}`}>
                        <button type="button" className="ed-group-head" aria-expanded={open} onClick={() => setOpenGroup(open ? "" : group)}>
                          <span>{group}</span>
                          {changedCount > 0 && <span className="ed-count">{changedCount} changed</span>}
                        </button>
                        {open && list.map(renderField)}
                      </section>
                    );
                  })}
                </>
              )}

              {tab === "pages" && <PagesPanel schema={schema} layout={layout} currentPageId={page.id} onLayout={setLayout} onOpenPage={openPage} />}
            </>
          )}
        </aside>

        <section className="ed-stage" ref={stageRef} aria-label="Preview">
          <div className="ed-frame-wrap" style={{ width: width * scale }}>
            <iframe
              ref={frameRef}
              title={`${state.site.name} preview`}
              src={`${state.site.url.replace(/\/$/, "")}/?bws-edit=1`}
              style={{ width, height: `${100 / scale}%`, transform: `scale(${scale})` }}
            />
          </div>
        </section>

        {showHistory && <History versions={state.versions} onRestore={restore} onClose={() => setShowHistory(false)} />}
      </div>
    </div>
  );
}
