import { useEffect, useRef, useState } from "react";
import { CONTRACT_LABELS, MILESTONE_LABELS, callAdmin, fileSize, formatDate, money } from "./shared.js";

const dollars = (cents) => (cents ? (cents / 100).toFixed(2).replace(/\.00$/, "") : "");

// A starting point for a new contract; every line can be changed or removed
const STARTER = {
  title: "Website redesign",
  status: "draft",
  published: false,
  summary: "",
  signedOn: "",
  startOn: "",
  launchOn: "",
  paymentTerms: "50% due at signing, 50% due at launch. Monthly support is billed on the 1st of each month.",
  costItems: [
    { label: "Design and build", details: "", amount: "" },
    { label: "Content and photo setup", details: "", amount: "" },
  ],
  monthly: "",
  monthlyLabel: "Hosting & support",
  monthlyStartsOn: "",
  monthlyIncludesText: "Hosting, SSL and daily backups\nSecurity and software updates\nSmall text and photo changes\nMonthly traffic report",
  timeline: [
    { title: "Kickoff and content", details: "", dueOn: "", status: "planned", deliverables: [{ title: "Logo, photos and copy collected", done: false }] },
    { title: "Design", details: "", dueOn: "", status: "planned", deliverables: [{ title: "Home page design approved", done: false }] },
    { title: "Build and review", details: "", dueOn: "", status: "planned", deliverables: [{ title: "Full site on a preview link", done: false }] },
    { title: "Launch", details: "", dueOn: "", status: "planned", deliverables: [{ title: "Site live on your domain", done: false }] },
  ],
  privateNotes: "",
};

function toForm(contract) {
  if (!contract) return structuredClone(STARTER);
  return {
    title: contract.title,
    status: contract.status,
    published: contract.published,
    summary: contract.summary ?? "",
    signedOn: contract.signed_on ?? "",
    startOn: contract.start_on ?? "",
    launchOn: contract.launch_on ?? "",
    paymentTerms: contract.payment_terms ?? "",
    costItems: contract.cost_items.map((item) => ({
      label: item.label,
      details: item.details ?? "",
      amount: dollars(item.amount_cents) || "0",
    })),
    monthly: dollars(contract.monthly_cents),
    monthlyLabel: contract.monthly_label ?? "",
    monthlyStartsOn: contract.monthly_starts_on ?? "",
    monthlyIncludesText: contract.monthly_includes.join("\n"),
    timeline: contract.timeline.map((step) => ({
      title: step.title,
      details: step.details ?? "",
      dueOn: step.due_on ?? "",
      status: step.status,
      deliverables: step.deliverables.map((entry) => ({ ...entry })),
    })),
    privateNotes: contract.private_notes ?? "",
  };
}

function toPayload(form) {
  return {
    ...form,
    monthlyIncludes: form.monthlyIncludesText.split("\n"),
  };
}

function move(list, index, step) {
  const next = [...list];
  const target = index + step;
  if (target < 0 || target >= next.length) return next;
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

function Field({ label, children, wide }) {
  return (
    <label className={`admin-field${wide ? " admin-field-wide" : ""}`}>
      <span>{label}</span>
      {children}
    </label>
  );
}

function RowTools({ index, count, onMove, onRemove, label }) {
  return (
    <div className="admin-row-tools">
      <button type="button" onClick={() => onMove(-1)} disabled={index === 0} aria-label={`Move ${label} up`}>
        ↑
      </button>
      <button type="button" onClick={() => onMove(1)} disabled={index === count - 1} aria-label={`Move ${label} down`}>
        ↓
      </button>
      <button type="button" onClick={onRemove} aria-label={`Remove ${label}`}>
        ✕
      </button>
    </div>
  );
}

function Documents({ demo, files, uploadLimit, fileCategories, run }) {
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [meta, setMeta] = useState({ title: "", category: "Agreement", note: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function pick(event) {
    const chosen = event.target.files?.[0] ?? null;
    setError("");
    if (chosen && chosen.size > uploadLimit) {
      setError(`That file is ${fileSize(chosen.size)}. The limit is ${fileSize(uploadLimit)}.`);
      setFile(null);
      return;
    }
    setFile(chosen);
    if (chosen && !meta.title) setMeta({ ...meta, title: chosen.name.replace(/\.[^.]+$/, "") });
  }

  async function upload(event) {
    event.preventDefault();
    if (!file) {
      setError("Choose a file first.");
      return;
    }
    setBusy(true);
    const data = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
      reader.onerror = reject;
      reader.readAsDataURL(file);
    }).catch(() => null);
    if (data === null) {
      setBusy(false);
      setError("That file couldn't be read.");
      return;
    }
    const message = await run({
      action: "uploadFile",
      demoId: demo.id,
      filename: file.name,
      contentType: file.type,
      data,
      ...meta,
    });
    setBusy(false);
    if (message) setError(message);
    else {
      setFile(null);
      setMeta({ title: "", category: meta.category, note: "" });
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <section className="portal-card" aria-labelledby="docs-title">
      <div className="portal-card-head">
        <h2 id="docs-title">Documents for the client</h2>
        <p className="portal-muted">Shown under Downloads in their portal</p>
      </div>

      {files.length === 0 ? (
        <p className="portal-empty">No documents yet.</p>
      ) : (
        <ul className="portal-invoices">
          {files.map((entry) => (
            <li key={entry.id}>
              <div>
                <p className="portal-invoice-title">
                  {entry.title}
                  {entry.category && <span className="portal-tag">{entry.category}</span>}
                </p>
                <p className="portal-muted portal-small">
                  {entry.filename} · {fileSize(entry.size_bytes)} · Added {formatDate(entry.created_at)}
                </p>
                {entry.note && <p className="portal-small portal-file-note">{entry.note}</p>}
              </div>
              <div className="admin-file-actions">
                <a className="portal-link-button" href={`/api/portal-file?id=${entry.id}`} download={entry.filename}>
                  Download
                </a>
                <button
                  type="button"
                  className="portal-text-button admin-danger"
                  onClick={() => {
                    if (window.confirm(`Remove "${entry.title}"? The client will no longer see it.`)) {
                      run({ action: "deleteFile", fileId: entry.id });
                    }
                  }}
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <form className="admin-upload" onSubmit={upload}>
        <Field label={`File (up to ${fileSize(uploadLimit)})`} wide>
          <input ref={inputRef} type="file" onChange={pick} />
        </Field>
        <Field label="Title">
          <input value={meta.title} onChange={(event) => setMeta({ ...meta, title: event.target.value })} maxLength={160} />
        </Field>
        <Field label="Type">
          <select value={meta.category} onChange={(event) => setMeta({ ...meta, category: event.target.value })}>
            {fileCategories.map((category) => (
              <option key={category}>{category}</option>
            ))}
          </select>
        </Field>
        <Field label="Note for the client (optional)" wide>
          <input value={meta.note} onChange={(event) => setMeta({ ...meta, note: event.target.value })} maxLength={600} />
        </Field>
        {error && (
          <p className="portal-error admin-field-wide" role="alert">
            {error}
          </p>
        )}
        <div className="admin-field-wide">
          <button type="submit" className="portal-button admin-small-button" disabled={busy || !file}>
            {busy ? "Uploading…" : "Upload"}
          </button>
        </div>
      </form>
      <p className="portal-small portal-muted">
        Files tagged Agreement also get a download button in the client's Agreement section.
      </p>
    </section>
  );
}

export default function ContractEditor({ demo, contract, files, uploadLimit, fileCategories, setData, onClose }) {
  const [form, setForm] = useState(() => toForm(contract));
  const [saved, setSaved] = useState(() => JSON.stringify(toForm(contract)));
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const dirty = JSON.stringify(form) !== saved;

  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (event) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  // Runs an action; returns an error message or null
  async function run(payload) {
    const result = await callAdmin(payload);
    if (result.data) {
      setData(result.data);
      return null;
    }
    if (result.signedOut) setData(null);
    return result.error;
  }

  const set = (key) => (event) => {
    const value = event.target.type === "checkbox" ? event.target.checked : event.target.value;
    setForm({ ...form, [key]: value });
    setNotice("");
  };

  const setItem = (index, key, value) =>
    setForm({ ...form, costItems: form.costItems.map((item, at) => (at === index ? { ...item, [key]: value } : item)) });

  const setStep = (index, changes) =>
    setForm({ ...form, timeline: form.timeline.map((step, at) => (at === index ? { ...step, ...changes } : step)) });

  const setDeliverable = (stepIndex, index, changes) =>
    setStep(stepIndex, {
      deliverables: form.timeline[stepIndex].deliverables.map((entry, at) => (at === index ? { ...entry, ...changes } : entry)),
    });

  async function save(event) {
    event?.preventDefault();
    setBusy(true);
    setError("");
    const message = await run({ action: "saveContract", demoId: demo.id, contract: toPayload(form) });
    setBusy(false);
    if (message) setError(message);
    else {
      // What the server stored (blank rows dropped) becomes the new baseline
      setSaved(JSON.stringify(form));
      setNotice(form.published ? "Saved. The client sees these changes now." : "Saved. Not shown to the client yet.");
    }
  }

  async function remove() {
    if (!window.confirm(`Delete the contract for ${demo.business_name}? This can't be undone. Uploaded documents stay.`)) return;
    const message = await run({ action: "deleteContract", demoId: demo.id });
    if (message) setError(message);
    else onClose();
  }

  async function togglePortal(event) {
    const message = await run({ action: "setPortal", demoId: demo.id, enabled: event.target.checked });
    if (message) setError(message);
  }

  const total = form.costItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

  return (
    <div className="admin-stack">
      <div className="admin-editor-head">
        <button type="button" className="portal-text-button" onClick={onClose}>
          ← All contracts
        </button>
        <div>
          <p className="portal-kicker">{contract ? CONTRACT_LABELS[contract.status] : "New contract"}</p>
          <h1>{demo.business_name}</h1>
          <p className="portal-muted portal-small">
            <a href={demo.demo_url} target="_blank" rel="noreferrer">
              {demo.demo_url.replace(/^https?:\/\//, "")}
            </a>{" "}
            · Access code {demo.demo_code} · {demo.accounts} portal {demo.accounts === 1 ? "account" : "accounts"}
          </p>
        </div>
      </div>

      <form className="admin-stack" onSubmit={save}>
        <section className="portal-card" aria-labelledby="visibility-title">
          <div className="portal-card-head">
            <h2 id="visibility-title">Status and visibility</h2>
          </div>
          <div className="admin-grid">
            <Field label="Project name">
              <input value={form.title} onChange={set("title")} maxLength={160} />
            </Field>
            <Field label="Contract status">
              <select value={form.status} onChange={set("status")}>
                {Object.entries(CONTRACT_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <label className="admin-check">
            <input type="checkbox" checked={form.published} onChange={set("published")} />
            <span>
              <strong>Show the agreement and timeline in the client's portal</strong>
              <span className="portal-muted portal-small">Leave off while you're still drafting.</span>
            </span>
          </label>
          <label className="admin-check">
            <input type="checkbox" checked={demo.portal_enabled} onChange={togglePortal} />
            <span>
              <strong>Client portal is on</strong>
              <span className="portal-muted portal-small">
                Lets the client create an account at /portal with access code {demo.demo_code}. Saves right away.
              </span>
            </span>
          </label>
          {form.published && !demo.portal_enabled && (
            <p className="portal-error">The portal is off, so the client can't see this yet.</p>
          )}
        </section>

        <section className="portal-card" aria-labelledby="agreement-title">
          <div className="portal-card-head">
            <h2 id="agreement-title">Agreement</h2>
          </div>
          <Field label="Scope summary (what we're building)" wide>
            <textarea rows={4} value={form.summary} onChange={set("summary")} maxLength={4000} />
          </Field>
          <div className="admin-grid admin-grid-3">
            <Field label="Signed on">
              <input type="date" value={form.signedOn} onChange={set("signedOn")} />
            </Field>
            <Field label="Work starts">
              <input type="date" value={form.startOn} onChange={set("startOn")} />
            </Field>
            <Field label="Target launch">
              <input type="date" value={form.launchOn} onChange={set("launchOn")} />
            </Field>
          </div>
          <Field label="Payment terms" wide>
            <textarea rows={3} value={form.paymentTerms} onChange={set("paymentTerms")} maxLength={2000} />
          </Field>
        </section>

        <section className="portal-card" aria-labelledby="costs-title">
          <div className="portal-card-head">
            <h2 id="costs-title">Project costs</h2>
            <p className="portal-muted portal-num">Total {money(Math.round(total * 100))}</p>
          </div>
          <ul className="admin-rows">
            {form.costItems.map((item, index) => (
              <li key={index} className="admin-cost-row">
                <Field label="Item">
                  <input value={item.label} onChange={(event) => setItem(index, "label", event.target.value)} maxLength={160} />
                </Field>
                <Field label="Details (optional)">
                  <input value={item.details} onChange={(event) => setItem(index, "details", event.target.value)} maxLength={600} />
                </Field>
                <Field label="Amount ($)">
                  <input
                    inputMode="decimal"
                    value={item.amount}
                    onChange={(event) => setItem(index, "amount", event.target.value)}
                    placeholder="0"
                  />
                </Field>
                <RowTools
                  index={index}
                  count={form.costItems.length}
                  label={item.label || "item"}
                  onMove={(step) => setForm({ ...form, costItems: move(form.costItems, index, step) })}
                  onRemove={() => setForm({ ...form, costItems: form.costItems.filter((_, at) => at !== index) })}
                />
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="portal-ghost-button admin-add"
            onClick={() => setForm({ ...form, costItems: [...form.costItems, { label: "", details: "", amount: "" }] })}
          >
            + Add a cost line
          </button>
        </section>

        <section className="portal-card" aria-labelledby="monthly-title">
          <div className="portal-card-head">
            <h2 id="monthly-title">Monthly support</h2>
            <p className="portal-muted">Leave the amount blank if there's no plan</p>
          </div>
          <div className="admin-grid admin-grid-3">
            <Field label="Plan name">
              <input value={form.monthlyLabel} onChange={set("monthlyLabel")} maxLength={120} />
            </Field>
            <Field label="Per month ($)">
              <input inputMode="decimal" value={form.monthly} onChange={set("monthly")} placeholder="0" />
            </Field>
            <Field label="Starts">
              <input type="date" value={form.monthlyStartsOn} onChange={set("monthlyStartsOn")} />
            </Field>
          </div>
          <Field label="What's included (one per line)" wide>
            <textarea rows={5} value={form.monthlyIncludesText} onChange={set("monthlyIncludesText")} />
          </Field>
        </section>

        <section className="portal-card" aria-labelledby="timeline-title">
          <div className="portal-card-head">
            <h2 id="timeline-title">Timeline and deliverables</h2>
            <p className="portal-muted">Tick deliverables as you hand them over</p>
          </div>
          <ol className="admin-rows">
            {form.timeline.map((step, index) => (
              <li key={index} className="admin-step">
                <div className="admin-step-head">
                  <span className="admin-step-number">{index + 1}</span>
                  <RowTools
                    index={index}
                    count={form.timeline.length}
                    label={step.title || "milestone"}
                    onMove={(direction) => setForm({ ...form, timeline: move(form.timeline, index, direction) })}
                    onRemove={() => setForm({ ...form, timeline: form.timeline.filter((_, at) => at !== index) })}
                  />
                </div>
                <div className="admin-grid admin-grid-3">
                  <Field label="Milestone">
                    <input value={step.title} onChange={(event) => setStep(index, { title: event.target.value })} maxLength={160} />
                  </Field>
                  <Field label="Target date">
                    <input type="date" value={step.dueOn} onChange={(event) => setStep(index, { dueOn: event.target.value })} />
                  </Field>
                  <Field label="Status">
                    <select value={step.status} onChange={(event) => setStep(index, { status: event.target.value })}>
                      {Object.entries(MILESTONE_LABELS).map(([key, label]) => (
                        <option key={key} value={key}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
                <Field label="Details (optional)" wide>
                  <textarea rows={2} value={step.details} onChange={(event) => setStep(index, { details: event.target.value })} maxLength={1000} />
                </Field>
                <p className="admin-mini-label">Deliverables</p>
                <ul className="admin-deliverables">
                  {step.deliverables.map((entry, position) => (
                    <li key={position}>
                      <input
                        type="checkbox"
                        checked={entry.done}
                        onChange={(event) => setDeliverable(index, position, { done: event.target.checked })}
                        aria-label={`Delivered: ${entry.title || "deliverable"}`}
                      />
                      <input
                        value={entry.title}
                        onChange={(event) => setDeliverable(index, position, { title: event.target.value })}
                        maxLength={200}
                        placeholder="What the client receives"
                        aria-label="Deliverable"
                      />
                      <button
                        type="button"
                        className="admin-icon-button"
                        aria-label="Remove deliverable"
                        onClick={() => setStep(index, { deliverables: step.deliverables.filter((_, at) => at !== position) })}
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  className="portal-text-button"
                  onClick={() => setStep(index, { deliverables: [...step.deliverables, { title: "", done: false }] })}
                >
                  + Add a deliverable
                </button>
              </li>
            ))}
          </ol>
          <button
            type="button"
            className="portal-ghost-button admin-add"
            onClick={() =>
              setForm({
                ...form,
                timeline: [...form.timeline, { title: "", details: "", dueOn: "", status: "planned", deliverables: [] }],
              })
            }
          >
            + Add a milestone
          </button>
        </section>

        <section className="portal-card" aria-labelledby="private-title">
          <div className="portal-card-head">
            <h2 id="private-title">Private notes</h2>
            <p className="portal-muted">Only you see these</p>
          </div>
          <textarea className="admin-input" rows={3} value={form.privateNotes} onChange={set("privateNotes")} maxLength={4000} />
        </section>

        <div className="admin-savebar">
          <div role="status">
            {error ? (
              <span className="portal-error">{error}</span>
            ) : notice && !dirty ? (
              <span className="portal-success">{notice}</span>
            ) : dirty ? (
              <span className="portal-muted">Unsaved changes</span>
            ) : (
              <span className="portal-muted">{contract ? `Saved ${formatDate(contract.updated_at)}` : "Not saved yet"}</span>
            )}
          </div>
          <div className="admin-savebar-actions">
            {contract && (
              <button type="button" className="portal-text-button admin-danger" onClick={remove}>
                Delete contract
              </button>
            )}
            <button type="submit" className="portal-button admin-small-button" disabled={busy || (!dirty && Boolean(contract))}>
              {busy ? "Saving…" : "Save contract"}
            </button>
          </div>
        </div>
      </form>

      <Documents demo={demo} files={files} uploadLimit={uploadLimit} fileCategories={fileCategories} run={run} />
    </div>
  );
}
