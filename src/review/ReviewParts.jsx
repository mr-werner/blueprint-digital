import { useState } from "react";
import {
  formatDate,
  hostOf,
  methodLabel,
  OUTREACH_METHODS,
  PLACEHOLDER_PATTERN,
} from "./format.js";

function initials(name) {
  return name
    .replace(/[^A-Za-z0-9 ]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join("");
}

// The client's logo, taken from their original website; initials if none loads
export function Logo({ demo, code }) {
  const [failed, setFailed] = useState(false);
  const src = `/api/review-shot?${new URLSearchParams({
    code,
    id: String(demo.id),
    kind: "logo",
  })}`;

  if (failed || !demo.original_url) {
    return (
      <span className="review-logo review-logo-initials" aria-hidden="true">
        {initials(demo.business_name)}
      </span>
    );
  }

  return (
    <img
      className="review-logo"
      src={src}
      alt={`${demo.business_name} logo`}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

export function ContactInfo({ demo }) {
  const phoneDigits = (demo.phone || "").replace(/\D/g, "");

  return (
    <dl className="review-contact">
      <div>
        <dt>Phone</dt>
        <dd>
          {demo.phone ? (
            <a href={`tel:${phoneDigits}`}>{demo.phone}</a>
          ) : (
            <span className="review-missing">Not on file</span>
          )}
        </dd>
      </div>
      <div>
        <dt>Email</dt>
        <dd>
          {demo.contact_email ? (
            <a href={`mailto:${demo.contact_email}`}>{demo.contact_email}</a>
          ) : (
            <span className="review-missing">Needed before emailing</span>
          )}
        </dd>
      </div>
      <div className="review-contact-wide">
        <dt>Address</dt>
        <dd>
          {demo.address ? (
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                `${demo.business_name}, ${demo.address}`
              )}`}
              target="_blank"
              rel="noreferrer"
            >
              {demo.address}
            </a>
          ) : (
            <span className="review-missing">Not on file</span>
          )}
        </dd>
      </div>
    </dl>
  );
}

// A screenshot tile; clicking it opens the site in a new tab
export function Preview({ label, url, src, primary = false }) {
  const [state, setState] = useState("loading");

  if (!url) {
    return (
      <div className="review-preview review-preview-empty">
        <span className="review-preview-label">{label}</span>
        <span className="review-preview-host">Not on file</span>
      </div>
    );
  }

  return (
    <a
      className={`review-preview${primary ? " review-preview-primary" : ""}`}
      href={url}
      target="_blank"
      rel="noreferrer"
      title={`Open ${label.toLowerCase()} site: ${hostOf(url)}`}
    >
      <span className={`review-shot review-shot-${state}`}>
        {state !== "failed" && (
          <img
            src={src}
            alt={`Screenshot of ${hostOf(url)}`}
            loading="lazy"
            onLoad={() => setState("loaded")}
            onError={() => setState("failed")}
          />
        )}
        {state === "failed" && <span>No preview yet</span>}
      </span>
      <span className="review-preview-label">{label}</span>
      <span className="review-preview-host">{hostOf(url)}</span>
    </a>
  );
}

export function EmailPanel({ demo, onAction }) {
  const [to, setTo] = useState(demo.contact_email || "");
  const [subject, setSubject] = useState(demo.email_subject || "");
  const [body, setBody] = useState(demo.email_body || "");
  const [busy, setBusy] = useState("");
  const [saved, setSaved] = useState(false);

  const placeholder = body.match(PLACEHOLDER_PATTERN)?.[0];
  const blocker = !demo.ready_to_email
    ? "Check \"Ready to email the client\" to turn on sending."
    : !to.trim()
      ? "Add the client's email address."
      : !subject.trim() || !body.trim()
        ? "Add a subject and a message."
        : placeholder
          ? `Replace ${placeholder} before sending.`
          : "";

  function draft() {
    return { action: "saveEmail", demoId: demo.id, to, subject, body };
  }

  async function save() {
    setBusy("save");
    const ok = await onAction(draft());
    setBusy("");
    setSaved(ok);
  }

  async function send() {
    const again = demo.emailed_at
      ? `\n\nThis client was already emailed on ${formatDate(demo.emailed_at)}.`
      : "";
    if (!window.confirm(`Send "${subject.trim()}" to ${to.trim()} now?${again}`)) {
      return;
    }

    setBusy("send");
    // Save first so the server sends exactly what is on screen
    const ok =
      (await onAction(draft())) &&
      (await onAction({
        action: "sendEmail",
        demoId: demo.id,
        sendAgain: Boolean(demo.emailed_at),
      }));
    setBusy("");
    setSaved(ok);
  }

  return (
    <details className="review-email">
      <summary>
        <span>Email the client</span>
        {demo.emailed_at ? (
          <span className="review-email-sent">
            Sent {formatDate(demo.emailed_at)}
          </span>
        ) : (
          <span className="review-email-draft">Draft</span>
        )}
      </summary>

      {demo.emailed_at && (
        <p className="review-email-note">
          Sent to {demo.emailed_to} on {formatDate(demo.emailed_at)}. A copy
          went to hello@blueprintwebstudio.com.
        </p>
      )}

      <label>
        To
        <input
          type="email"
          value={to}
          onChange={(event) => {
            setTo(event.target.value);
            setSaved(false);
          }}
          placeholder="client@example.com"
        />
      </label>
      <label>
        Subject
        <input
          type="text"
          value={subject}
          onChange={(event) => {
            setSubject(event.target.value);
            setSaved(false);
          }}
        />
      </label>
      <label>
        Message
        <textarea
          rows={12}
          value={body}
          onChange={(event) => {
            setBody(event.target.value);
            setSaved(false);
          }}
        />
      </label>
      <p className="review-email-hint">
        **bold**, - bullet and numbered lines are formatted in the email. A
        copy is sent to hello@blueprintwebstudio.com, and replies go there too.
      </p>

      {blocker && <p className="review-email-blocker">{blocker}</p>}

      <div className="review-email-actions">
        <button type="button" onClick={save} disabled={Boolean(busy)}>
          {busy === "save" ? "Saving…" : saved ? "Saved" : "Save draft"}
        </button>
        <button
          type="button"
          className="review-email-send"
          onClick={send}
          disabled={Boolean(busy) || Boolean(blocker)}
        >
          {busy === "send"
            ? "Sending…"
            : demo.emailed_at
              ? "Send again"
              : "Send email"}
        </button>
      </div>
    </details>
  );
}

// How the business has been reached so far, and a quick way to try the others
export function Outreach({ demo, onAction }) {
  const [busy, setBusy] = useState("");
  const [editingForm, setEditingForm] = useState(false);
  const [formUrl, setFormUrl] = useState(demo.contact_form_url || "");
  const phoneDigits = (demo.phone || "").replace(/\D/g, "");

  async function run(key, payload) {
    setBusy(key);
    const ok = await onAction(payload);
    setBusy("");
    return ok;
  }

  async function saveFormUrl(event) {
    event.preventDefault();
    const ok = await run("formUrl", {
      action: "saveFormUrl",
      demoId: demo.id,
      formUrl,
    });
    if (ok) setEditingForm(false);
  }

  function reachLink(key) {
    if (key === "email") {
      return demo.contact_email ? (
        <a href={`mailto:${demo.contact_email}`}>{demo.contact_email}</a>
      ) : (
        <span className="review-missing">No address on file</span>
      );
    }
    if (key === "phone") {
      return demo.phone ? (
        <a href={`tel:${phoneDigits}`}>{demo.phone}</a>
      ) : (
        <span className="review-missing">No number on file</span>
      );
    }
    if (editingForm) {
      return (
        <form className="review-outreach-form" onSubmit={saveFormUrl}>
          <input
            type="url"
            value={formUrl}
            onChange={(event) => setFormUrl(event.target.value)}
            placeholder="https://…/contact"
            aria-label={`Contact form link for ${demo.business_name}`}
          />
          <button type="submit" disabled={busy === "formUrl"}>
            Save
          </button>
        </form>
      );
    }
    return (
      <>
        {demo.contact_form_url ? (
          <a href={demo.contact_form_url} target="_blank" rel="noreferrer">
            Open form
          </a>
        ) : demo.original_url ? (
          <a href={demo.original_url} target="_blank" rel="noreferrer">
            Find it on their site
          </a>
        ) : (
          <span className="review-missing">No link on file</span>
        )}
        <button
          type="button"
          className="review-outreach-edit"
          onClick={() => setEditingForm(true)}
        >
          {demo.contact_form_url ? "Edit link" : "Add link"}
        </button>
      </>
    );
  }

  return (
    <section
      className="review-outreach"
      aria-label={`How ${demo.business_name} has been contacted`}
    >
      <h3>Outreach</h3>

      <ul className="review-outreach-methods">
        {OUTREACH_METHODS.map(({ key, label }) => {
          const tries = demo.contacts.filter((entry) => entry.method === key);
          const last = tries[tries.length - 1];

          return (
            <li
              key={key}
              className={tries.length ? "review-outreach-done" : undefined}
            >
              <div className="review-outreach-head">
                <strong>{label}</strong>
                <span className="review-outreach-state">
                  {tries.length === 0
                    ? "Not tried"
                    : last.contacted_at
                      ? `Tried ${formatDate(last.contacted_at)}${
                          tries.length > 1 ? ` · ${tries.length}×` : ""
                        }`
                      : "Tried earlier"}
                </span>
              </div>
              <div className="review-outreach-reach">{reachLink(key)}</div>
              <button
                type="button"
                className="review-outreach-log"
                disabled={busy === key}
                onClick={() =>
                  run(key, { action: "logContact", demoId: demo.id, method: key })
                }
              >
                {busy === key ? "Saving…" : `Log ${label.toLowerCase()}`}
              </button>
            </li>
          );
        })}
      </ul>

      {demo.contacts.length > 0 && (
        <details className="review-outreach-history">
          <summary>
            History ({demo.contacts.length}{" "}
            {demo.contacts.length === 1 ? "entry" : "entries"})
          </summary>
          <ul>
            {demo.contacts.map((entry) => (
              <li key={entry.id}>
                <span>
                  <strong>{methodLabel(entry.method)}</strong>
                  {" · "}
                  {entry.contacted_at
                    ? formatDate(entry.contacted_at)
                    : "date not recorded"}
                  {entry.note && <small>{entry.note}</small>}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm("Remove this entry?")) {
                      onAction({ action: "deleteContact", contactId: entry.id });
                    }
                  }}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

const REQUEST_STATUS_OPTIONS = [
  { key: "new", label: "New" },
  { key: "in_progress", label: "In progress" },
  { key: "done", label: "Done" },
  { key: "declined", label: "Not planned" },
];

const INVOICE_STATUS_OPTIONS = [
  { key: "draft", label: "Draft (hidden from client)" },
  { key: "open", label: "Due" },
  { key: "paid", label: "Paid" },
  { key: "void", label: "Void" },
];

function dollars(cents) {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function RequestItem({ request, onAction }) {
  const [status, setStatus] = useState(request.status);
  const [reply, setReply] = useState(request.studio_reply || "");
  const [saving, setSaving] = useState(false);
  const changed = status !== request.status || reply !== (request.studio_reply || "");

  async function save() {
    setSaving(true);
    await onAction({ action: "updateRequest", requestId: request.id, status, reply });
    setSaving(false);
  }

  return (
    <li className={`review-note${["done", "declined"].includes(request.status) ? " review-note-done" : ""}`}>
      <p className="review-note-body">{request.body}</p>
      <div className="review-note-meta">
        <span>
          #{request.id} · {request.page || "Whole site"} · {request.priority} priority ·{" "}
          {formatDate(request.created_at)}
          {request.author && ` · ${request.author}`}
        </span>
      </div>
      <div className="review-portal-edit">
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          aria-label={`Status of request ${request.id}`}
        >
          {REQUEST_STATUS_OPTIONS.map(({ key, label }) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
        <input
          type="text"
          value={reply}
          maxLength={2000}
          onChange={(event) => setReply(event.target.value)}
          placeholder="Reply the client will see (optional)"
          aria-label={`Reply to request ${request.id}`}
        />
        <button type="button" onClick={save} disabled={saving || !changed}>
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </li>
  );
}

function InvoiceForm({ demo, onAction }) {
  const blank = { number: "", description: "", amount: "", dueOn: "", status: "open", paymentUrl: "" };
  const [invoice, setInvoice] = useState(blank);
  const [saving, setSaving] = useState(false);
  const set = (key) => (event) => setInvoice({ ...invoice, [key]: event.target.value });

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    const ok = await onAction({ action: "addInvoice", demoId: demo.id, invoice });
    setSaving(false);
    if (ok) setInvoice(blank);
  }

  return (
    <form className="review-invoice-form" onSubmit={submit}>
      <input value={invoice.number} onChange={set("number")} placeholder="Invoice #" aria-label="Invoice number" required />
      <input
        value={invoice.description}
        onChange={set("description")}
        placeholder="Description, e.g. Website build deposit"
        aria-label="Invoice description"
        required
      />
      <input
        type="number"
        min="0"
        step="0.01"
        value={invoice.amount}
        onChange={set("amount")}
        placeholder="Amount ($)"
        aria-label="Amount in dollars"
        required
      />
      <input type="date" value={invoice.dueOn} onChange={set("dueOn")} aria-label="Due date" />
      <select value={invoice.status} onChange={set("status")} aria-label="Invoice status">
        {INVOICE_STATUS_OPTIONS.map(({ key, label }) => (
          <option key={key} value={key}>
            {label}
          </option>
        ))}
      </select>
      <input
        type="url"
        value={invoice.paymentUrl}
        onChange={set("paymentUrl")}
        placeholder="Payment link (optional)"
        aria-label="Payment link"
      />
      <button type="submit" disabled={saving}>
        {saving ? "Adding…" : "Add invoice"}
      </button>
    </form>
  );
}

export function ClientPortal({ demo, onAction }) {
  const openRequests = demo.requests.filter((request) => ["new", "in_progress"].includes(request.status));
  const closedRequests = demo.requests.filter((request) => !["new", "in_progress"].includes(request.status));

  return (
    <section className="review-notes" aria-label={`Client portal for ${demo.business_name}`}>
      <h3>
        Client portal
        {openRequests.length > 0 && (
          <span className="review-notes-count">{openRequests.length} open requests</span>
        )}
      </h3>

      <label className="review-portal-toggle">
        <input
          type="checkbox"
          checked={demo.portal_enabled}
          onChange={(event) => onAction({ action: "setPortal", demoId: demo.id, enabled: event.target.checked })}
        />
        <span>
          Client can sign up at <a href="/portal" target="_blank" rel="noreferrer">/portal</a> with code{" "}
          {demo.demo_code}
        </span>
      </label>

      {demo.portal_enabled && (
        <>
          <p className="review-portal-accounts">
            {demo.accounts.length === 0
              ? "No one has signed up yet."
              : demo.accounts
                  .map(
                    (account) =>
                      `${account.name} (${account.email})${
                        account.last_login_at ? `, last in ${formatDate(account.last_login_at)}` : ""
                      }`
                  )
                  .join(" · ")}
          </p>

          {openRequests.length > 0 && <ul className="review-note-list">{openRequests.map((request) => (
            <RequestItem key={`${request.id}-${request.status}-${request.studio_reply}`} request={request} onAction={onAction} />
          ))}</ul>}

          {closedRequests.length > 0 && (
            <details className="review-notes-done">
              <summary>
                {closedRequests.length} closed {closedRequests.length === 1 ? "request" : "requests"}
              </summary>
              <ul className="review-note-list">
                {closedRequests.map((request) => (
                  <RequestItem key={`${request.id}-${request.status}-${request.studio_reply}`} request={request} onAction={onAction} />
                ))}
              </ul>
            </details>
          )}

          <details className="review-notes-done">
            <summary>
              Invoices ({demo.invoices.length}
              {demo.invoices.some((item) => item.status === "open") &&
                `, ${dollars(
                  demo.invoices
                    .filter((item) => item.status === "open")
                    .reduce((total, item) => total + item.amount_cents, 0)
                )} due`}
              )
            </summary>
            {demo.invoices.length > 0 && (
              <ul className="review-invoice-list">
                {demo.invoices.map((item) => (
                  <li key={item.id}>
                    <span>
                      #{item.number} · {item.description} · {dollars(item.amount_cents)}
                    </span>
                    <select
                      value={item.status}
                      onChange={(event) =>
                        onAction({ action: "setInvoiceStatus", invoiceId: item.id, status: event.target.value })
                      }
                      aria-label={`Status of invoice ${item.number}`}
                    >
                      {INVOICE_STATUS_OPTIONS.map(({ key, label }) => (
                        <option key={key} value={key}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </li>
                ))}
              </ul>
            )}
            <InvoiceForm demo={demo} onAction={onAction} />
          </details>
        </>
      )}
    </section>
  );
}
