import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";

// The client site editor. The client's own site runs in the preview frame with ?bws-edit=1;
// it tells us which fields it has (the "ready" message), we send it the edits as they change,
// and it tells us when an element is clicked or dragged to a new size.
// Edits are overrides only: a field missing from `edits` shows the site's built-in content.

const MESSAGE_SOURCE = "bws-editor";
const AUTOSAVE_MS = 1200;
const READY_TIMEOUT_MS = 15000;
const MAX_IMAGE_SIDE = 2000;
const DEVICES = [
  { id: "desktop", label: "Desktop", width: 1280 },
  { id: "tablet", label: "Tablet", width: 820 },
  { id: "phone", label: "Phone", width: 390 },
];

async function callEditor(payload) {
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

function originOf(url) {
  try {
    return new URL(url).origin;
  } catch {
    return "";
  }
}

function sameEdits(a, b) {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) if (a[key] !== b[key]) return false;
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

// Shrinks big photos in the browser before upload; GIFs keep their animation
async function prepareImage(file) {
  if (file.type === "image/gif" || !/^image\/(jpeg|png|webp)$/.test(file.type)) return file;
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;
  const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && file.size < 900_000) return file;

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const type = file.type === "image/png" ? "image/png" : "image/webp";
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, type, 0.86));
  return blob && blob.size < file.size ? blob : file;
}

function toBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function FieldControl({ field, value, changed, onChange, onReset, onFocus, selected }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const ref = useRef(null);
  const id = `field-${field.key}`;

  useEffect(() => {
    if (selected) ref.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [selected]);

  async function upload(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setUploading(true);
    setError("");
    const prepared = await prepareImage(file);
    const result = await callEditor({ action: "upload", filename: file.name, data: await toBase64(prepared) });
    setUploading(false);
    if (result.error) setError(result.error);
    else onChange(result.data.url);
  }

  let control;
  if (field.type === "textarea") {
    control = <textarea id={id} rows={field.rows || 4} value={value} onChange={(e) => onChange(e.target.value)} onFocus={onFocus} />;
  } else if (field.type === "color") {
    control = (
      <div className="ed-color">
        <input type="color" value={/^#[0-9a-f]{6}$/i.test(value) ? value : "#000000"} onChange={(e) => onChange(e.target.value)} onFocus={onFocus} aria-label={`${field.label} picker`} />
        <input id={id} type="text" value={value} maxLength={7} spellCheck="false" onChange={(e) => onChange(e.target.value)} onFocus={onFocus} />
      </div>
    );
  } else if (field.type === "size") {
    control = (
      <div className="ed-size">
        <input id={id} type="range" min={field.min} max={field.max} step={field.step || 1} value={value} onChange={(e) => onChange(Number(e.target.value))} onFocus={onFocus} />
        <span className="ed-size-value">
          {value}
          {field.unit || ""}
        </span>
      </div>
    );
  } else if (field.type === "image") {
    control = (
      <div className="ed-image">
        <span className="ed-image-thumb">{value ? <img src={value} alt="" /> : <em>No image</em>}</span>
        <label className="ed-button ed-button-small">
          {uploading ? "Uploading…" : "Replace image"}
          <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={upload} disabled={uploading} hidden />
        </label>
      </div>
    );
  } else {
    const inputType = { link: "url", email: "email", phone: "tel" }[field.type] || "text";
    control = <input id={id} type={inputType} value={value} onChange={(e) => onChange(e.target.value)} onFocus={onFocus} placeholder={field.placeholder || ""} />;
  }

  return (
    <div ref={ref} className={`ed-field${changed ? " is-changed" : ""}${selected ? " is-selected" : ""}`}>
      <div className="ed-field-head">
        <label htmlFor={id}>{field.label}</label>
        {changed && (
          <button type="button" className="ed-reset" onClick={onReset} title="Go back to the original">
            Reset
          </button>
        )}
      </div>
      {control}
      {field.help && <p className="ed-help">{field.help}</p>}
      {error && <p className="ed-error">{error}</p>}
    </div>
  );
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
  const key = action.key || "";
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
  } else {
    value = String(value ?? "");
  }
  return value === field.default ? undefined : value;
}

export default function SiteEditor() {
  const [state, setState] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [fields, setFields] = useState(null);
  const [groups, setGroups] = useState([]);
  const [frameProblem, setFrameProblem] = useState(false);
  const [history, dispatch] = useReducer(historyReducer, EMPTY_HISTORY);
  const [saveState, setSaveState] = useState("saved");
  const [notice, setNotice] = useState("");
  const [device, setDevice] = useState("desktop");
  const [openGroup, setOpenGroup] = useState("");
  const [selected, setSelected] = useState("");
  const [query, setQuery] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [stageWidth, setStageWidth] = useState(1000);
  const frameRef = useRef(null);
  const stageRef = useRef(null);
  const [saved, setSaved] = useState({});

  const { edits, past, future } = history;
  const siteOrigin = state ? originOf(state.site.url) : "";
  const published = state?.published ?? {};
  const fieldMap = useMemo(() => Object.fromEntries((fields || []).map((f) => [f.key, f])), [fields]);

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

  const selectField = useCallback(
    (key) => {
      setSelected(key);
      setQuery("");
      if (fieldMap[key]) setOpenGroup(fieldMap[key].group);
    },
    [fieldMap]
  );

  // Messages from the site in the preview frame
  useEffect(() => {
    if (!siteOrigin) return undefined;
    function onMessage(event) {
      if (event.origin !== siteOrigin || event.data?.source !== MESSAGE_SOURCE) return;
      const message = event.data;
      if (message.type === "ready" && Array.isArray(message.fields)) {
        setFields(message.fields);
        setGroups(message.groups || [...new Set(message.fields.map((f) => f.group))]);
        setFrameProblem(false);
      } else if (message.type === "select" && fieldMap[message.key]) {
        selectField(message.key);
      } else if (message.type === "change" && fieldMap[message.key]) {
        const value = normalize(fieldMap[message.key], message.value);
        if (value !== null) dispatch({ type: "set", key: message.key, value });
        selectField(message.key);
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [siteOrigin, fieldMap, selectField]);

  // Sites that don't answer haven't been set up for the editor yet
  useEffect(() => {
    if (!state || fields) return undefined;
    const timer = setTimeout(() => setFrameProblem(true), READY_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [state, fields]);

  // Keep the preview in step with the edits (and resend once the site says it's ready)
  useEffect(() => {
    if (fields) send({ type: "content", content: edits });
  }, [edits, fields, send]);

  useEffect(() => {
    if (selected && fields) send({ type: "focus", key: selected });
  }, [selected, fields, send]);

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

  function updateField(field, rawValue) {
    const value = normalize(field, rawValue);
    if (value === null) return;
    dispatch({ type: "set", key: field.key, value });
  }

  useEffect(() => {
    function onKey(event) {
      const mod = event.metaKey || event.ctrlKey;
      if (!mod || event.key.toLowerCase() !== "z") return;
      if (event.target.closest?.("input[type=text], input[type=url], input[type=email], input[type=tel], textarea")) return;
      event.preventDefault();
      dispatch({ type: event.shiftKey ? "redo" : "undo" });
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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
          {!fields && !frameProblem && <p className="ed-empty">Loading your site's content…</p>}
          {frameProblem && !fields && (
            <p className="ed-error">
              Your site didn't connect to the editor. Try reloading this page. If it keeps happening, email hello@blueprintwebstudio.com.
            </p>
          )}
          {fields && (
            <>
              <p className="ed-tip">Click anything on your site to jump to it here. Drag the blue handles to resize.</p>
              <input className="ed-search" type="search" placeholder="Find a field…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Find a field" />
              {groups.map((group) => {
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
                    {open &&
                      list.map((field) => (
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
                      ))}
                  </section>
                );
              })}
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
