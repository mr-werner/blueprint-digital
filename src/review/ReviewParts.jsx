import { useState } from "react";
import { formatDate, hostOf, PLACEHOLDER_PATTERN } from "./format.js";

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
