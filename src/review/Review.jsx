import { useEffect, useState } from "react";
import { formatDate, methodLabel } from "./format.js";
import {
  ContactInfo,
  EmailPanel,
  Logo,
  Outreach,
  Preview,
} from "./ReviewParts.jsx";

const STORAGE_KEY = "bws-review-code";

// Contact filter tabs; each test returns true for the concepts it shows
const CONTACT_FILTERS = [
  { key: "all", label: "All", test: () => true },
  { key: "todo", label: "Not contacted", test: (demo) => demo.contacts.length === 0 },
  { key: "contacted", label: "Contacted", test: (demo) => demo.contacts.length > 0 },
  {
    key: "noEmail",
    label: "Needs an email address",
    test: (demo) => !demo.contact_email,
  },
];

function shotUrl(code, id, kind) {
  const params = new URLSearchParams({ code, id: String(id), kind });
  return `/api/review-shot?${params}`;
}

function readStoredCode() {
  try {
    return sessionStorage.getItem(STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

function storeCode(code) {
  try {
    if (code) sessionStorage.setItem(STORAGE_KEY, code);
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage can be blocked; the page still works without it
  }
}

export default function Review() {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(() => Boolean(readStoredCode()));
  const [demos, setDemos] = useState(null);
  const [filter, setFilter] = useState("");
  const [contactFilter, setContactFilter] = useState("all");
  const [accessCode, setAccessCode] = useState("");
  const [actionError, setActionError] = useState("");

  // Asks the server for the concept list; returns either demos or an error message
  async function requestDemos(submittedCode, payload = {}) {
    try {
      const response = await fetch("/api/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, code: submittedCode }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.success) {
        if (response.status === 401) storeCode("");
        return {
          error: data.message || "That review code isn't valid.",
          locked: response.status === 401,
        };
      }

      storeCode(submittedCode);
      return { demos: data.demos, code: submittedCode };
    } catch (lookupError) {
      console.error("Review lookup error:", lookupError);
      return {
        error: "We couldn't load the review page right now. Please try again.",
      };
    }
  }

  function applyResult(result) {
    setLoading(false);
    if (result.demos) {
      setDemos(result.demos);
      setAccessCode(result.code);
    } else setError(result.error);
  }

  // Saves a note or checkbox change, then refreshes the list from the server
  async function runAction(payload) {
    setActionError("");
    const result = await requestDemos(accessCode, payload);

    if (result.demos) {
      setDemos(result.demos);
      return true;
    }

    if (result.locked) {
      lock();
      setError("Your review code changed. Enter the new code.");
    } else {
      setActionError(result.error);
    }
    return false;
  }

  // Reopen without retyping the code for the rest of this browser tab
  useEffect(() => {
    const saved = readStoredCode();
    if (saved) requestDemos(saved).then(applyResult);
  }, []);

  function handleSubmit(event) {
    event.preventDefault();
    const trimmed = code.trim();

    if (!trimmed) {
      setError("Please enter your review code.");
      return;
    }

    setLoading(true);
    setError("");
    requestDemos(trimmed).then(applyResult);
  }

  function lock() {
    storeCode("");
    setDemos(null);
    setAccessCode("");
    setCode("");
  }

  if (!demos) {
    return (
      <main className="review-gate">
        <form className="review-gate-card" onSubmit={handleSubmit}>
          <img
            src="/blueprint-webstudio-logo-text.png"
            alt="Blueprint WebStudio"
            className="review-gate-logo"
          />
          <p className="review-kicker">Internal</p>
          <h1>Concept review</h1>
          <p className="review-gate-text">
            Enter the review code to see every concept site.
          </p>

          <label htmlFor="review-code">Review code</label>
          <input
            id="review-code"
            type="text"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck="false"
            value={code}
            onChange={(event) => {
              setCode(event.target.value);
              setError("");
            }}
            placeholder="Enter review code"
            autoFocus
          />

          {error && <p className="review-error">{error}</p>}

          <button type="submit" className="review-button" disabled={loading}>
            {loading ? "Checking…" : "Open review page"}
          </button>
        </form>
      </main>
    );
  }

  const query = filter.trim().toLowerCase();
  const contactTest =
    CONTACT_FILTERS.find((item) => item.key === contactFilter)?.test ??
    CONTACT_FILTERS[0].test;
  const visible = demos.filter(
    (demo) =>
      contactTest(demo) &&
      [demo.business_name, demo.category, demo.city, demo.demo_url]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query)
  );
  const activeCount = demos.filter((demo) => demo.status === "active").length;
  const viewedCount = demos.filter((demo) => demo.view_count > 0).length;
  const readyCount = demos.filter((demo) => demo.ready_to_email).length;
  const contactedCount = demos.filter((demo) => demo.contacts.length > 0).length;
  const openNoteCount = demos.reduce(
    (total, demo) =>
      total + demo.notes.filter((note) => !note.resolved_at).length,
    0
  );

  return (
    <main className="review-page">
      <header className="review-header">
        <div>
          <p className="review-kicker">Blueprint WebStudio · Internal</p>
          <h1>Concept review</h1>
          <p className="review-summary">
            {demos.length} concepts · {activeCount} active · {viewedCount}{" "}
            opened by a client · {readyCount} ready to email · {contactedCount} contacted ·{" "}
            {openNoteCount} open {openNoteCount === 1 ? "note" : "notes"}
          </p>
        </div>
        <div className="review-header-actions">
          <input
            type="search"
            className="review-filter"
            placeholder="Filter by name, city or type"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            aria-label="Filter concepts"
          />
          <button type="button" className="review-lock" onClick={lock}>
            Lock
          </button>
        </div>
      </header>

      <div className="review-tabs" role="group" aria-label="Filter by contact">
        {CONTACT_FILTERS.map((item) => (
          <button
            key={item.key}
            type="button"
            className="review-tab"
            aria-pressed={contactFilter === item.key}
            onClick={() => setContactFilter(item.key)}
          >
            {item.label}
            <span>{demos.filter(item.test).length}</span>
          </button>
        ))}
      </div>

      {actionError && (
        <p className="review-error review-action-error" role="alert">
          {actionError}
        </p>
      )}

      <ul className="review-grid">
        {visible.map((demo) => (
          <li
            key={demo.id}
            className={`review-card${demo.ready_to_email ? " review-card-ready" : ""}`}
          >
            <div className="review-card-head">
              <Logo demo={demo} code={accessCode} />
              <div className="review-card-title">
                <p className="review-meta">
                  {[demo.category, demo.city].filter(Boolean).join(" · ") ||
                    "Concept"}
                </p>
                <h2>{demo.business_name}</h2>
                {demo.contacts.length > 0 && (
                  <p className="review-contacted">
                    Reached by{" "}
                    {[...new Set(demo.contacts.map((entry) => entry.method))]
                      .map((key) => methodLabel(key).toLowerCase())
                      .join(", ")}
                  </p>
                )}
              </div>
              <span
                className={`review-status review-status-${demo.status}`}
                title={`Status in Neon: ${demo.status}`}
              >
                {demo.status}
              </span>
            </div>

            <ContactInfo demo={demo} />

            <div className="review-previews">
              <Preview
                label="Original"
                url={demo.original_url}
                src={shotUrl(accessCode, demo.id, "original")}
              />
              <Preview
                label="Concept"
                url={demo.demo_url}
                src={shotUrl(accessCode, demo.id, "concept")}
                primary
              />
            </div>

            {demo.background && (
              <p className="review-background">{demo.background}</p>
            )}

            <dl className="review-facts">
              <div>
                <dt>Client code</dt>
                <dd className="review-code">{demo.demo_code}</dd>
              </div>
              <div>
                <dt>Client views</dt>
                <dd>
                  {demo.view_count}
                  {demo.last_viewed_at &&
                    ` · last ${formatDate(demo.last_viewed_at)}`}
                </dd>
              </div>
              <div>
                <dt>Added</dt>
                <dd>{formatDate(demo.created_at)}</dd>
              </div>
            </dl>

            <ConceptNotes demo={demo} onAction={runAction} />

            <label className="review-ready">
              <input
                type="checkbox"
                checked={demo.ready_to_email}
                onChange={(event) => {
                  const ready = event.target.checked;
                  // Show the change right away; the server reply confirms it
                  setDemos((current) =>
                    current.map((item) =>
                      item.id === demo.id
                        ? { ...item, ready_to_email: ready, ready_at: new Date().toISOString() }
                        : item
                    )
                  );
                  runAction({ action: "setReady", demoId: demo.id, ready });
                }}
              />
              <span>
                <strong>Ready to email the client</strong>
                <small>
                  {demo.ready_to_email
                    ? `Marked ${formatDate(demo.ready_at)}. Nothing is sent until you press Send.`
                    : "Check when this concept is finished. Nothing is sent automatically."}
                </small>
              </span>
            </label>

            <Outreach demo={demo} onAction={runAction} />

            <EmailPanel demo={demo} onAction={runAction} />
          </li>
        ))}
      </ul>

      {visible.length === 0 && (
        <p className="review-empty">
          {query ? `No concepts match “${filter}” here.` : "No concepts here."}
        </p>
      )}
    </main>
  );
}

function ConceptNotes({ demo, onAction }) {
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const openNotes = demo.notes.filter((note) => !note.resolved_at);
  const doneNotes = demo.notes.filter((note) => note.resolved_at);

  async function addNote(event) {
    event.preventDefault();
    const body = draft.trim();
    if (!body) return;

    setSaving(true);
    const saved = await onAction({ action: "addNote", demoId: demo.id, body });
    setSaving(false);
    if (saved) setDraft("");
  }

  function renderNote(note) {
    const done = Boolean(note.resolved_at);

    return (
      <li key={note.id} className={`review-note${done ? " review-note-done" : ""}`}>
        <p className="review-note-body">{note.body}</p>
        {note.resolution && (
          <p className="review-note-resolution">Done: {note.resolution}</p>
        )}
        <div className="review-note-meta">
          <span>
            {formatDate(note.created_at)}
            {done && ` · done ${formatDate(note.resolved_at)}`}
          </span>
          <button
            type="button"
            onClick={() =>
              onAction({
                action: "setNoteResolved",
                noteId: note.id,
                resolved: !done,
              })
            }
          >
            {done ? "Reopen" : "Mark done"}
          </button>
          <button
            type="button"
            onClick={() => {
              if (window.confirm("Delete this note?")) {
                onAction({ action: "deleteNote", noteId: note.id });
              }
            }}
          >
            Delete
          </button>
        </div>
      </li>
    );
  }

  return (
    <section className="review-notes" aria-label={`Notes for ${demo.business_name}`}>
      <h3>
        Notes for Claude
        {openNotes.length > 0 && (
          <span className="review-notes-count">{openNotes.length} open</span>
        )}
      </h3>

      {openNotes.length > 0 && (
        <ul className="review-note-list">{openNotes.map(renderNote)}</ul>
      )}

      {doneNotes.length > 0 && (
        <details className="review-notes-done">
          <summary>
            {doneNotes.length} done {doneNotes.length === 1 ? "note" : "notes"}
          </summary>
          <ul className="review-note-list">{doneNotes.map(renderNote)}</ul>
        </details>
      )}

      <form className="review-note-form" onSubmit={addNote}>
        <textarea
          rows={2}
          maxLength={4000}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="What should change on this concept?"
          aria-label={`New note for ${demo.business_name}`}
        />
        <button type="submit" disabled={saving || !draft.trim()}>
          {saving ? "Saving…" : "Add note"}
        </button>
      </form>
    </section>
  );
}
