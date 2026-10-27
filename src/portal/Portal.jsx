import { useEffect, useState } from "react";
import VisitsChart from "./VisitsChart.jsx";

const STUDIO_EMAIL = "hello@blueprintwebstudio.com";
const STUDIO_PHONE = "(720) 515-6647";

// Where on the site a change is wanted; kept general so it fits every client
const PAGE_OPTIONS = [
  "Whole site",
  "Home page",
  "Header & menu",
  "Photos & images",
  "Text & wording",
  "Contact details",
  "Products, services or pricing",
  "Something else",
];

const PRIORITY_LABELS = { low: "Whenever", normal: "Normal", high: "Soon, please" };

const STATUS_LABELS = {
  new: "Received",
  in_progress: "In progress",
  done: "Done",
  declined: "Not planned",
};

const INVOICE_LABELS = { open: "Due", paid: "Paid", void: "Void" };

async function callPortal(payload) {
  try {
    const response = await fetch("/api/portal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.success) {
      return {
        error: data.message || "Something went wrong. Please try again.",
        signedOut: response.status === 401 && !["signin", "signup"].includes(payload.action),
      };
    }
    return { data };
  } catch {
    return { error: "We couldn't reach the portal. Check your connection and try again." };
  }
}

function money(cents) {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function formatDate(value) {
  if (!value) return "";
  // Plain dates ("2026-10-26") are calendar days, not moments in UTC
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : new Date(value);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// "Today", "Yesterday" or "Oct 21", short enough for a stat tile
function shortDay(value) {
  if (!value) return "–";
  const date = new Date(value);
  const days = Math.round(
    (new Date().setHours(0, 0, 0, 0) - new Date(value).setHours(0, 0, 0, 0)) / 86400000
  );
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function hostOf(url) {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return url;
  }
}

// Links can open a specific screen: ?mode=signup, or ?reset=<token> from a reset email
function initialAuthState() {
  const params = new URLSearchParams(window.location.search);
  const resetToken = params.get("reset") || "";
  if (resetToken) return { mode: "reset", resetToken };
  return { mode: params.get("mode") === "signup" ? "signup" : "signin", resetToken: "" };
}

// Drops ?reset=… from the address bar so the token isn't left in history
function clearQuery() {
  try {
    window.history.replaceState(null, "", window.location.pathname);
  } catch {
    // Older browsers keep the query; nothing breaks
  }
}

// A reset link opens the new-password form even if this browser is signed in
const OPENED_FROM_RESET = new URLSearchParams(window.location.search).has("reset");

const AUTH_COPY = {
  signin: {
    title: "Welcome back",
    text: "Sign in to see your project, invoices, documents and change requests.",
    button: "Sign in",
  },
  signup: {
    title: "Create your account",
    text: "Use the access code we sent with your website to link your account to it.",
    button: "Create account",
  },
  forgot: {
    title: "Reset your password",
    text: "Enter the email you signed up with and we'll send you a link to choose a new password.",
    button: "Email me a reset link",
  },
  reset: {
    title: "Choose a new password",
    text: "Pick a new password for your client portal account.",
    button: "Save new password",
  },
};

function AuthScreen({ onSignedIn }) {
  const [{ mode, resetToken }, setAuth] = useState(initialAuthState);
  const [form, setForm] = useState({ code: "", name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const update = (key) => (event) => {
    setForm({ ...form, [key]: event.target.value });
    setError("");
  };

  function switchMode(next) {
    setAuth({ mode: next, resetToken: "" });
    setError("");
    setNotice("");
    if (resetToken) clearQuery();
  }

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");

    let payload = { action: mode, ...form };
    if (mode === "forgot") payload = { action: "requestReset", email: form.email };
    if (mode === "reset") payload = { action: "resetPassword", token: resetToken, password: form.password };

    const result = await callPortal(payload);
    setBusy(false);

    if (!result.data) {
      setError(result.error);
      return;
    }
    if (mode === "forgot") {
      setNotice(result.data.message);
      return;
    }
    if (mode === "reset") clearQuery();
    onSignedIn(result.data);
  }

  const signingUp = mode === "signup";
  const needsEmail = mode !== "reset";
  const needsPassword = mode !== "forgot";
  const newPassword = signingUp || mode === "reset";
  const copy = AUTH_COPY[mode];

  return (
    <main className="portal-gate">
      <form className="portal-gate-card" onSubmit={submit}>
        <img src="/blueprint-webstudio-logo-text.png" alt="Blueprint WebStudio" className="portal-gate-logo" />
        <p className="portal-kicker">Client portal</p>
        <h1>{copy.title}</h1>
        <p className="portal-muted">{copy.text}</p>

        {(mode === "signin" || signingUp) && (
          <div className="portal-tabs" role="tablist" aria-label="Sign in or create an account">
            {[
              ["signin", "Sign in"],
              ["signup", "Create account"],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={mode === key}
                className={mode === key ? "is-active" : ""}
                onClick={() => switchMode(key)}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {signingUp && (
          <>
            <label htmlFor="portal-code">Access code</label>
            <input
              id="portal-code"
              className="portal-code-input"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck="false"
              placeholder="ABCD1234"
              value={form.code}
              onChange={update("code")}
              required
            />
            <label htmlFor="portal-name">Your name</label>
            <input id="portal-name" autoComplete="name" value={form.name} onChange={update("name")} required />
          </>
        )}

        {needsEmail && (
          <>
            <label htmlFor="portal-email">Email</label>
            <input
              id="portal-email"
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={update("email")}
              required
            />
          </>
        )}

        {needsPassword && (
          <>
            <div className="portal-label-row">
              <label htmlFor="portal-password">{mode === "reset" ? "New password" : "Password"}</label>
              {mode === "signin" && (
                <button type="button" className="portal-inline-link" onClick={() => switchMode("forgot")}>
                  Forgot password?
                </button>
              )}
            </div>
            <input
              id="portal-password"
              type="password"
              autoComplete={newPassword ? "new-password" : "current-password"}
              minLength={newPassword ? 8 : undefined}
              value={form.password}
              onChange={update("password")}
              required
            />
            {newPassword && <p className="portal-hint">At least 8 characters.</p>}
          </>
        )}

        {error && (
          <p className="portal-error" role="alert">
            {error}
          </p>
        )}
        {notice && (
          <p className="portal-success" role="status">
            {notice}
          </p>
        )}

        <button type="submit" className="portal-button" disabled={busy}>
          {busy ? "One moment…" : copy.button}
        </button>

        {mode === "forgot" || mode === "reset" ? (
          <p className="portal-hint portal-gate-help">
            <button type="button" className="portal-inline-link" onClick={() => switchMode("signin")}>
              Back to sign in
            </button>
          </p>
        ) : (
          <p className="portal-hint portal-gate-help">
            {signingUp ? "No access code? " : "Need a hand? "}
            Email <a href={`mailto:${STUDIO_EMAIL}`}>{STUDIO_EMAIL}</a>.
          </p>
        )}
      </form>
    </main>
  );
}

function StatTile({ label, value, note }) {
  return (
    <div className="portal-stat">
      <p className="portal-stat-label">{label}</p>
      <p className="portal-stat-value">{value}</p>
      {note && <p className="portal-stat-note">{note}</p>}
    </div>
  );
}

function Stats({ stats }) {
  const { totals, daily, referrers, days } = stats;
  const mobileShare = totals.visits ? Math.round((totals.mobile / totals.visits) * 100) : 0;

  return (
    <section className="portal-card" aria-labelledby="stats-title">
      <div className="portal-card-head">
        <h2 id="stats-title">Site statistics</h2>
        <p className="portal-muted">Last {days} days</p>
      </div>

      <div className="portal-stats">
        <StatTile label="Page views" value={totals.visits.toLocaleString()} />
        <StatTile label="Visitors" value={totals.visitors.toLocaleString()} note="Counted once per day" />
        <StatTile label="On a phone" value={totals.visits ? `${mobileShare}%` : "–"} />
        <StatTile label="Last visit" value={shortDay(totals.last_visit)} />
      </div>

      <VisitsChart daily={daily} />

      {referrers.length > 0 && (
        <div className="portal-referrers">
          <h3>Where visitors came from</h3>
          <ul>
            {referrers.map((row) => (
              <li key={row.source}>
                <span>{row.source}</span>
                <span className="portal-num">{row.visits}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

const CONTRACT_LABELS = {
  draft: "Proposal",
  sent: "Ready to sign",
  signed: "Signed",
  in_progress: "In progress",
  complete: "Complete",
};

const MILESTONE_LABELS = { planned: "Upcoming", in_progress: "In progress", done: "Done" };

function projectTotal(contract) {
  return contract.cost_items.reduce((total, item) => total + item.amount_cents, 0);
}

function Agreement({ contract, files }) {
  const total = projectTotal(contract);
  const agreementFiles = files.filter((file) => file.category === "Agreement");
  const dates = [
    contract.signed_on && ["Signed", contract.signed_on],
    contract.start_on && ["Work starts", contract.start_on],
    contract.launch_on && ["Target launch", contract.launch_on],
  ].filter(Boolean);

  return (
    <section className="portal-card" aria-labelledby="agreement-title">
      <div className="portal-card-head">
        <h2 id="agreement-title">Agreement</h2>
        <span className={`portal-pill portal-pill-contract-${contract.status}`}>
          {CONTRACT_LABELS[contract.status] ?? contract.status}
        </span>
      </div>

      <p className="portal-agreement-title">{contract.title}</p>
      {contract.summary && <p className="portal-agreement-summary">{contract.summary}</p>}

      {dates.length > 0 && (
        <dl className="portal-dates">
          {dates.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{formatDate(value)}</dd>
            </div>
          ))}
        </dl>
      )}

      <div className="portal-agreement-grid">
        <div className="portal-agreement-block">
          <h3 className="portal-subhead">Project cost</h3>
          {contract.cost_items.length === 0 ? (
            <p className="portal-empty">The cost breakdown will show here.</p>
          ) : (
            <table className="portal-cost-table">
              <tbody>
                {contract.cost_items.map((item, index) => (
                  <tr key={index}>
                    <th scope="row">
                      {item.label}
                      {item.details && <span className="portal-muted portal-small">{item.details}</span>}
                    </th>
                    <td className="portal-num">{money(item.amount_cents)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row">Project total</th>
                  <td className="portal-num">{money(total)}</td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>

        <div className="portal-agreement-block portal-monthly">
          <h3 className="portal-subhead">{contract.monthly_label || "Monthly support"}</h3>
          {contract.monthly_cents > 0 ? (
            <>
              <p className="portal-monthly-price">
                <span className="portal-num">{money(contract.monthly_cents)}</span>
                <span className="portal-muted"> / month</span>
              </p>
              {contract.monthly_starts_on && (
                <p className="portal-muted portal-small">Starts {formatDate(contract.monthly_starts_on)}</p>
              )}
              {contract.monthly_includes.length > 0 && (
                <ul className="portal-checklist">
                  {contract.monthly_includes.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <p className="portal-empty">No monthly plan on this agreement.</p>
          )}
        </div>
      </div>

      {contract.payment_terms && (
        <div className="portal-terms">
          <h3 className="portal-subhead">Payment terms</h3>
          <p>{contract.payment_terms}</p>
        </div>
      )}

      {agreementFiles.length > 0 && (
        <p className="portal-agreement-files">
          {agreementFiles.map((file) => (
            <a key={file.id} className="portal-link-button" href={`/api/portal-file?id=${file.id}`} download={file.filename}>
              Download {file.title}
            </a>
          ))}
        </p>
      )}
    </section>
  );
}

// Deliverables marked done, across the whole timeline
function deliveryCount(contract) {
  const all = (contract?.timeline ?? []).flatMap((step) => step.deliverables);
  return { done: all.filter((entry) => entry.done).length, total: all.length };
}

function Timeline({ contract }) {
  if (!contract || contract.timeline.length === 0) {
    return (
      <section className="portal-card" aria-labelledby="timeline-title">
        <div className="portal-card-head">
          <h2 id="timeline-title">Project timeline</h2>
        </div>
        <p className="portal-empty">Your project's milestones and deliverables will show up here once we've agreed on them.</p>
      </section>
    );
  }

  const { done, total } = deliveryCount(contract);
  const percent = total ? Math.round((done / total) * 100) : 0;

  return (
    <section className="portal-card" aria-labelledby="timeline-title">
      <div className="portal-card-head">
        <h2 id="timeline-title">Project timeline</h2>
        <p className="portal-muted">
          {done} of {total} delivered
        </p>
      </div>

      <div
        className="portal-progress"
        role="progressbar"
        aria-label="Deliverables completed"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
      >
        <span style={{ width: `${percent}%` }} />
      </div>

      <ol className="portal-timeline">
        {contract.timeline.map((step, index) => (
          <li key={index} className={`portal-step portal-step-${step.status}`}>
            <span className="portal-step-marker" aria-hidden="true">
              {step.status === "done" ? "✓" : index + 1}
            </span>
            <div className="portal-step-body">
              <div className="portal-step-head">
                <h3>{step.title}</h3>
                <span className={`portal-pill portal-pill-step-${step.status}`}>
                  {MILESTONE_LABELS[step.status] ?? step.status}
                </span>
                {step.due_on && (
                  <span className="portal-muted portal-small">
                    Target {formatDate(step.due_on)}
                  </span>
                )}
              </div>
              {step.details && <p className="portal-step-details">{step.details}</p>}
              {step.deliverables.length > 0 && (
                <ul className="portal-deliverables">
                  {step.deliverables.map((entry, position) => (
                    <li key={position} className={entry.done ? "is-done" : ""}>
                      <span aria-hidden="true">{entry.done ? "✓" : ""}</span>
                      {entry.title}
                      <span className="portal-visually-hidden">{entry.done ? " (delivered)" : " (not yet)"}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Financials({ invoices, contract, files }) {
  const due = invoices.filter((invoice) => invoice.status === "open");
  const paid = invoices.filter((invoice) => invoice.status === "paid");
  const sum = (rows) => rows.reduce((total, row) => total + row.amount_cents, 0);

  return (
    <>
    {contract && <Agreement contract={contract} files={files} />}
    <section className="portal-card" aria-labelledby="money-title">
      <div className="portal-card-head">
        <h2 id="money-title">Invoices</h2>
      </div>

      <div className="portal-stats portal-stats-2">
        <StatTile label="Balance due" value={money(sum(due))} />
        <StatTile label="Paid to date" value={money(sum(paid))} />
      </div>

      {invoices.length === 0 ? (
        <p className="portal-empty">No invoices yet. They'll show up here as soon as they're issued.</p>
      ) : (
        <ul className="portal-invoices">
          {invoices.map((invoice) => (
            <li key={invoice.id}>
              <div>
                <p className="portal-invoice-title">
                  {invoice.description}
                  <span className="portal-muted"> · #{invoice.number}</span>
                </p>
                <p className="portal-muted portal-small">
                  Issued {formatDate(invoice.issued_on)}
                  {invoice.status === "open" && invoice.due_on && ` · Due ${formatDate(invoice.due_on)}`}
                  {invoice.status === "paid" && invoice.paid_on && ` · Paid ${formatDate(invoice.paid_on)}`}
                </p>
              </div>
              <div className="portal-invoice-side">
                <span className="portal-num portal-invoice-amount">{money(invoice.amount_cents)}</span>
                <span className={`portal-pill portal-pill-${invoice.status}`}>
                  {INVOICE_LABELS[invoice.status] ?? invoice.status}
                </span>
                {invoice.status === "open" && invoice.payment_url && (
                  <a className="portal-link-button" href={invoice.payment_url} target="_blank" rel="noreferrer">
                    Pay now
                  </a>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
    </>
  );
}

function fileSize(bytes) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function Downloads({ files }) {
  return (
    <section className="portal-card" aria-labelledby="files-title">
      <div className="portal-card-head">
        <h2 id="files-title">Downloads</h2>
        <p className="portal-muted">Save copies for your records or to share with anyone else</p>
      </div>

      {files.length === 0 ? (
        <p className="portal-empty">No documents yet. Your agreement, invoices and site files will be here to download.</p>
      ) : (
        <ul className="portal-invoices portal-files">
          {files.map((file) => (
            <li key={file.id}>
              <div>
                <p className="portal-invoice-title">
                  {file.title}
                  {file.category && <span className="portal-tag">{file.category}</span>}
                </p>
                <p className="portal-muted portal-small">
                  {file.filename} · {fileSize(file.size_bytes)} · Added {formatDate(file.created_at)}
                </p>
                {file.note && <p className="portal-small portal-file-note">{file.note}</p>}
              </div>
              <div className="portal-invoice-side">
                <a className="portal-link-button" href={`/api/portal-file?id=${file.id}`} download={file.filename}>
                  Download
                </a>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function RequestForm({ onSaved }) {
  const [page, setPage] = useState(PAGE_OPTIONS[0]);
  const [priority, setPriority] = useState("normal");
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(event) {
    event.preventDefault();
    if (!body.trim()) {
      setError("Describe the change you'd like.");
      return;
    }
    setBusy(true);
    setError("");
    const ok = await onSaved({ action: "addRequest", page, priority, body });
    setBusy(false);
    if (ok === true) {
      setBody("");
      setSent(true);
    } else setError(ok);
  }

  return (
    <form className="portal-request-form" onSubmit={submit}>
      <div className="portal-row">
        <div>
          <label htmlFor="request-page">Where on the site?</label>
          <select id="request-page" value={page} onChange={(event) => setPage(event.target.value)}>
            {PAGE_OPTIONS.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="request-priority">How soon?</label>
          <select id="request-priority" value={priority} onChange={(event) => setPriority(event.target.value)}>
            {Object.entries(PRIORITY_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <label htmlFor="request-body">What would you like changed?</label>
      <textarea
        id="request-body"
        rows={5}
        maxLength={4000}
        placeholder="For example: swap the hero photo for our new shop picture, and add our Saturday hours to the footer."
        value={body}
        onChange={(event) => {
          setBody(event.target.value);
          setError("");
          setSent(false);
        }}
      />

      {error && (
        <p className="portal-error" role="alert">
          {error}
        </p>
      )}
      {sent && (
        <p className="portal-success" role="status">
          Got it. We'll update the status here as we work on it.
        </p>
      )}

      <button type="submit" className="portal-button" disabled={busy}>
        {busy ? "Sending…" : "Send request"}
      </button>
    </form>
  );
}

function Requests({ requests, onAction }) {
  const open = requests.filter((request) => ["new", "in_progress"].includes(request.status)).length;

  return (
    <section className="portal-card" aria-labelledby="requests-title">
      <div className="portal-card-head">
        <h2 id="requests-title">Change requests</h2>
        <p className="portal-muted">{open === 1 ? "1 open" : `${open} open`}</p>
      </div>

      <div className="portal-requests">
        <RequestForm onSaved={onAction} />

        <div>
          <h3 className="portal-subhead">Your requests</h3>
          {requests.length === 0 ? (
            <p className="portal-empty">Nothing yet. Anything you send shows up here with its status.</p>
          ) : (
            <ul className="portal-request-list">
              {requests.map((request) => (
                <li key={request.id}>
                  <div className="portal-request-meta">
                    <span className={`portal-pill portal-pill-${request.status}`}>
                      {STATUS_LABELS[request.status] ?? request.status}
                    </span>
                    <span className="portal-muted portal-small">
                      {request.page || "Whole site"} · {formatDate(request.created_at)}
                      {request.author && ` · ${request.author}`}
                    </span>
                  </div>
                  <p className="portal-request-body">{request.body}</p>
                  {request.studio_reply && (
                    <p className="portal-reply">
                      <strong>Blueprint WebStudio:</strong> {request.studio_reply}
                    </p>
                  )}
                  {request.status === "new" && (
                    <button
                      type="button"
                      className="portal-text-button"
                      onClick={() => onAction({ action: "cancelRequest", requestId: request.id })}
                    >
                      Withdraw
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

const TABS = [
  { key: "requests", label: "Change requests" },
  { key: "financials", label: "Financials" },
  { key: "timeline", label: "Timeline" },
  { key: "stats", label: "Site statistics" },
  { key: "downloads", label: "Downloads" },
];

function readTab() {
  // "#files" was the Downloads tab's first name
  const hash = window.location.hash.slice(1);
  const key = hash === "files" ? "downloads" : hash;
  return TABS.some((tab) => tab.key === key) ? key : TABS[0].key;
}

// A short figure under each tab name so clients see what's new without opening it
function tabSummary(key, data) {
  if (key === "requests") {
    const open = data.requests.filter((request) => ["new", "in_progress"].includes(request.status)).length;
    return open ? `${open} open` : "None open";
  }
  if (key === "financials") {
    if (data.contract && !data.invoices.some((invoice) => invoice.status === "open")) {
      return "Agreement & invoices";
    }
    const due = data.invoices
      .filter((invoice) => invoice.status === "open")
      .reduce((total, invoice) => total + invoice.amount_cents, 0);
    return due ? `${money(due)} due` : "Nothing due";
  }
  if (key === "timeline") {
    const { done, total } = deliveryCount(data.contract);
    return total ? `${done} of ${total} delivered` : "Coming soon";
  }
  if (key === "downloads") {
    const count = data.files.length;
    return count ? `${count} ${count === 1 ? "document" : "documents"}` : "None yet";
  }
  const views = data.stats.totals.visits;
  return `${views.toLocaleString()} ${views === 1 ? "view" : "views"}, 30 days`;
}

function DashboardTabs({ data, onAction }) {
  const [active, setActive] = useState(readTab);

  // Keeps the open tab in the address so a refresh or the back button lands on it
  useEffect(() => {
    const onHash = () => setActive(readTab());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  function choose(key) {
    setActive(key);
    try {
      window.history.replaceState(null, "", `#${key}`);
    } catch {
      // The tab still switches without updating the address
    }
  }

  function onKeyDown(event) {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
    if (!step) return;
    event.preventDefault();
    const index = TABS.findIndex((tab) => tab.key === active);
    const next = TABS[(index + step + TABS.length) % TABS.length];
    choose(next.key);
    document.getElementById(`tab-${next.key}`)?.focus();
  }

  return (
    <>
      <div className="portal-tabbar" role="tablist" aria-label="Dashboard sections" onKeyDown={onKeyDown}>
        {TABS.map((tab) => (
          <button
            key={tab.key}
            id={`tab-${tab.key}`}
            type="button"
            role="tab"
            aria-selected={active === tab.key}
            aria-controls={`panel-${tab.key}`}
            tabIndex={active === tab.key ? 0 : -1}
            className={active === tab.key ? "is-active" : ""}
            onClick={() => choose(tab.key)}
          >
            <span className="portal-tab-label">{tab.label}</span>
            <span className="portal-tab-summary">{tabSummary(tab.key, data)}</span>
          </button>
        ))}
      </div>

      <div className="portal-panel" id={`panel-${active}`} role="tabpanel" aria-labelledby={`tab-${active}`}>
        {active === "requests" && <Requests requests={data.requests} onAction={onAction} />}
        {active === "financials" && (
          <Financials invoices={data.invoices} contract={data.contract} files={data.files} />
        )}
        {active === "timeline" && <Timeline contract={data.contract} />}
        {active === "stats" && <Stats stats={data.stats} />}
        {active === "downloads" && <Downloads files={data.files} />}
      </div>
    </>
  );
}

function Dashboard({ data, onAction, onSignOut }) {
  const { account, site } = data;
  const firstName = account.name.split(/\s+/)[0];

  return (
    <div className="portal-shell">
      <header className="portal-header">
        <div className="portal-header-inner">
          <a href="/" className="portal-brand">
            <img src="/blueprint-webstudio-logo-text.png" alt="" />
            <span>Blueprint WebStudio</span>
          </a>
          <div className="portal-header-side">
            <span className="portal-muted portal-small portal-hide-sm">{account.email}</span>
            <button type="button" className="portal-ghost-button" onClick={onSignOut}>
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="portal-main">
        <section className="portal-hero">
          <div>
            <p className="portal-kicker">{site.name}</p>
            <h1>Hi {firstName}, here's how your site is doing.</h1>
          </div>
          <div className="portal-hero-actions">
            {site.editorEnabled && (
              <a className="portal-button portal-site-button" href="/portal/editor/">
                Edit my site
              </a>
            )}
            <a className="portal-button portal-site-button" href={site.url} target="_blank" rel="noreferrer">
              Open {hostOf(site.url)}
            </a>
          </div>
        </section>

        <DashboardTabs data={data} onAction={onAction} />

        <footer className="portal-footer">
          Questions? Call <a href={`tel:+17205156647`}>{STUDIO_PHONE}</a> or email{" "}
          <a href={`mailto:${STUDIO_EMAIL}`}>{STUDIO_EMAIL}</a>.
        </footer>
      </main>
    </div>
  );
}

export default function Portal() {
  const [data, setData] = useState(null);
  const [checking, setChecking] = useState(!OPENED_FROM_RESET);
  const [notice, setNotice] = useState("");

  // A saved session cookie skips the sign-in screen (but not a reset link)
  useEffect(() => {
    if (OPENED_FROM_RESET) return;
    callPortal({ action: "me" }).then((result) => {
      if (result.data?.site) setData(result.data);
      setChecking(false);
    });
  }, []);

  // Runs a dashboard action; returns true, or an error message for the form
  async function runAction(payload) {
    const result = await callPortal(payload);
    if (result.data) {
      setData(result.data);
      setNotice("");
      return true;
    }
    if (result.signedOut) {
      setData(null);
      return result.error;
    }
    setNotice(result.error);
    return result.error;
  }

  async function signOut() {
    await callPortal({ action: "signout" });
    setData(null);
  }

  if (checking) {
    return (
      <main className="portal-gate">
        <p className="portal-loading">Loading your portal…</p>
      </main>
    );
  }

  if (!data) return <AuthScreen onSignedIn={setData} />;

  return (
    <>
      {notice && (
        <p className="portal-banner" role="alert">
          {notice}
        </p>
      )}
      <Dashboard data={data} onAction={runAction} onSignOut={signOut} />
    </>
  );
}
