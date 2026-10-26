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

function AuthScreen({ onSignedIn }) {
  const [mode, setMode] = useState("signin");
  const [form, setForm] = useState({ code: "", name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const update = (key) => (event) => {
    setForm({ ...form, [key]: event.target.value });
    setError("");
  };

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const result = await callPortal({ action: mode, ...form });
    setBusy(false);
    if (result.data) onSignedIn(result.data);
    else setError(result.error);
  }

  const signingUp = mode === "signup";

  return (
    <main className="portal-gate">
      <form className="portal-gate-card" onSubmit={submit}>
        <img src="/blueprint-webstudio-logo-text.png" alt="Blueprint WebStudio" className="portal-gate-logo" />
        <p className="portal-kicker">Client portal</p>
        <h1>{signingUp ? "Create your account" : "Welcome back"}</h1>
        <p className="portal-muted">
          {signingUp
            ? "Use the access code we sent with your website to link your account to it."
            : "Sign in to see your site's visits, invoices and change requests."}
        </p>

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
              onClick={() => {
                setMode(key);
                setError("");
              }}
            >
              {label}
            </button>
          ))}
        </div>

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

        <label htmlFor="portal-email">Email</label>
        <input
          id="portal-email"
          type="email"
          autoComplete="email"
          value={form.email}
          onChange={update("email")}
          required
        />

        <label htmlFor="portal-password">Password</label>
        <input
          id="portal-password"
          type="password"
          autoComplete={signingUp ? "new-password" : "current-password"}
          minLength={signingUp ? 8 : undefined}
          value={form.password}
          onChange={update("password")}
          required
        />
        {signingUp && <p className="portal-hint">At least 8 characters.</p>}

        {error && (
          <p className="portal-error" role="alert">
            {error}
          </p>
        )}

        <button type="submit" className="portal-button" disabled={busy}>
          {busy ? "One moment…" : signingUp ? "Create account" : "Sign in"}
        </button>

        <p className="portal-hint portal-gate-help">
          {signingUp ? "No access code? " : "Forgot your password? "}
          Email <a href={`mailto:${STUDIO_EMAIL}`}>{STUDIO_EMAIL}</a> and we'll sort it out.
        </p>
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
    <section className="portal-card portal-span-2" aria-labelledby="stats-title">
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

function Financials({ invoices }) {
  const due = invoices.filter((invoice) => invoice.status === "open");
  const paid = invoices.filter((invoice) => invoice.status === "paid");
  const sum = (rows) => rows.reduce((total, row) => total + row.amount_cents, 0);

  return (
    <section className="portal-card" aria-labelledby="money-title">
      <div className="portal-card-head">
        <h2 id="money-title">Financials</h2>
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
    <section className="portal-card portal-span-3" aria-labelledby="requests-title">
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
          <a className="portal-button portal-site-button" href={site.url} target="_blank" rel="noreferrer">
            Open {hostOf(site.url)}
          </a>
        </section>

        <div className="portal-grid">
          <Stats stats={data.stats} />
          <Financials invoices={data.invoices} />
          <Requests requests={data.requests} onAction={onAction} />
        </div>

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
  const [checking, setChecking] = useState(true);
  const [notice, setNotice] = useState("");

  // A saved session cookie skips the sign-in screen
  useEffect(() => {
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
