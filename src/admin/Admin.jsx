import { useEffect, useState } from "react";
import ContractEditor from "./ContractEditor.jsx";
import { CONTRACT_LABELS, callAdmin, deliveryCount, formatDate, money, projectTotal } from "./shared.js";

function SignIn({ needsSetup, onSignedIn }) {
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
    const result = await callAdmin({ action: needsSetup ? "setup" : "signin", ...form });
    setBusy(false);
    if (result.data) onSignedIn(result.data);
    else setError(result.error);
  }

  return (
    <main className="portal-gate">
      <form className="portal-gate-card" onSubmit={submit}>
        <img src="/blueprint-webstudio-logo-text.png" alt="Blueprint WebStudio" className="portal-gate-logo" />
        <p className="portal-kicker">Studio dashboard</p>
        <h1>{needsSetup ? "Create your studio login" : "Sign in"}</h1>
        <p className="portal-muted">
          {needsSetup
            ? "This is a one-time step. Enter the review code to prove it's you, then choose the email and password you'll sign in with."
            : "Your projects, contracts, concept reviews and client portals in one place."}
        </p>

        {needsSetup && (
          <>
            <label htmlFor="admin-code">Review code</label>
            <input
              id="admin-code"
              className="portal-code-input"
              autoComplete="off"
              spellCheck="false"
              value={form.code}
              onChange={update("code")}
              required
            />
            <label htmlFor="admin-name">Your name</label>
            <input id="admin-name" autoComplete="name" value={form.name} onChange={update("name")} required />
          </>
        )}

        <label htmlFor="admin-email">Email</label>
        <input
          id="admin-email"
          type="email"
          autoComplete="email"
          value={form.email}
          onChange={update("email")}
          required
        />
        <label htmlFor="admin-password">Password</label>
        <input
          id="admin-password"
          type="password"
          autoComplete={needsSetup ? "new-password" : "current-password"}
          minLength={needsSetup ? 10 : undefined}
          value={form.password}
          onChange={update("password")}
          required
        />
        {needsSetup && <p className="portal-hint">At least 10 characters.</p>}

        {error && (
          <p className="portal-error" role="alert">
            {error}
          </p>
        )}

        <button type="submit" className="portal-button" disabled={busy}>
          {busy ? "One moment…" : needsSetup ? "Create login" : "Sign in"}
        </button>
      </form>
    </main>
  );
}

function Tile({ label, value, note }) {
  return (
    <div className="portal-stat">
      <p className="portal-stat-label">{label}</p>
      <p className="portal-stat-value">{value}</p>
      {note && <p className="portal-stat-note">{note}</p>}
    </div>
  );
}

const PRIORITY_LABELS = { low: "Whenever", normal: "Normal", high: "Soon" };

function Overview({ data, open }) {
  const { overview, requests, contracts } = data;

  return (
    <div className="admin-stack">
      <section className="portal-card" aria-labelledby="money-title">
        <div className="portal-card-head">
          <h2 id="money-title">Business</h2>
          <p className="portal-muted">Signed, in-progress and complete contracts</p>
        </div>
        <div className="portal-stats">
          <Tile label="Monthly recurring" value={money(overview.monthlyCents)} note="Support plans" />
          <Tile
            label="Booked projects"
            value={money(overview.bookedCents)}
            note={`${overview.booked} ${overview.booked === 1 ? "contract" : "contracts"}`}
          />
          <Tile label="Balance due" value={money(overview.dueCents)} note="Open invoices" />
          <Tile label="Paid this month" value={money(overview.paidMonthCents)} note={`${money(overview.paidTotalCents)} all time`} />
        </div>
      </section>

      <section className="portal-card" aria-labelledby="pipeline-title">
        <div className="portal-card-head">
          <h2 id="pipeline-title">Outreach pipeline</h2>
          <a className="portal-link-button" href="/review/">
            Open concept reviews
          </a>
        </div>
        <div className="admin-stats-5">
          <Tile label="Concepts" value={overview.concepts} />
          <Tile label="Emailed" value={overview.emailed} />
          <Tile label="Opened by client" value={overview.opened} />
          <Tile label="Portals on" value={overview.portals} />
          <Tile label="Client accounts" value={overview.clientAccounts} />
        </div>
      </section>

      <div className="admin-two">
        <section className="portal-card" aria-labelledby="requests-title">
          <div className="portal-card-head">
            <h2 id="requests-title">Open change requests</h2>
            <p className="portal-muted">{overview.openRequests}</p>
          </div>
          {requests.length === 0 ? (
            <p className="portal-empty">Nothing waiting on you.</p>
          ) : (
            <ul className="admin-list">
              {requests.slice(0, 8).map((request) => (
                <li key={request.id}>
                  <div className="admin-list-top">
                    <strong>{request.business_name}</strong>
                    <span className={`portal-pill portal-pill-${request.status}`}>
                      {request.status === "new" ? "New" : "In progress"}
                    </span>
                    {request.priority === "high" && <span className="portal-pill admin-pill-urgent">{PRIORITY_LABELS.high}</span>}
                  </div>
                  <p className="admin-clamp">{request.body}</p>
                  <p className="portal-muted portal-small">
                    {request.page || "Whole site"} · {formatDate(request.created_at)}
                  </p>
                </li>
              ))}
            </ul>
          )}
          <p className="portal-small portal-muted">
            Reply and update statuses from the client portal panel on <a href="/review/">Concept reviews</a>.
          </p>
        </section>

        <section className="portal-card" aria-labelledby="recent-title">
          <div className="portal-card-head">
            <h2 id="recent-title">Projects under contract</h2>
            <button type="button" className="portal-text-button" onClick={() => open("contracts")}>
              See all
            </button>
          </div>
          {contracts.length === 0 ? (
            <p className="portal-empty">No contracts yet. Start one from the Contracts tab.</p>
          ) : (
            <ul className="admin-list">
              {contracts.slice(0, 6).map((contract) => {
                const { done, total } = deliveryCount(contract);
                return (
                  <li key={contract.id}>
                    <button type="button" className="admin-row-button" onClick={() => open(`contract-${contract.demo_id}`)}>
                      <span className="admin-list-top">
                        <strong>{contract.business_name}</strong>
                        <span className={`portal-pill portal-pill-contract-${contract.status}`}>
                          {CONTRACT_LABELS[contract.status]}
                        </span>
                      </span>
                      <span className="portal-muted portal-small">
                        {money(projectTotal(contract))}
                        {contract.monthly_cents > 0 && ` + ${money(contract.monthly_cents)}/mo`}
                        {total > 0 && ` · ${done}/${total} delivered`}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function NewContract({ demos, contracts, onStart }) {
  const [query, setQuery] = useState("");
  const taken = new Set(contracts.map((contract) => String(contract.demo_id)));
  const choices = demos.filter(
    (demo) =>
      !taken.has(String(demo.id)) &&
      [demo.business_name, demo.city, demo.demo_url].filter(Boolean).join(" ").toLowerCase().includes(query.toLowerCase())
  );

  return (
    <section className="portal-card" aria-labelledby="new-title">
      <div className="portal-card-head">
        <h2 id="new-title">Start a contract</h2>
      </div>
      <input
        type="search"
        className="admin-input"
        placeholder="Find a client by name, city or site"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        aria-label="Find a client"
      />
      <ul className="admin-picker">
        {choices.slice(0, 12).map((demo) => (
          <li key={demo.id}>
            <button type="button" className="admin-row-button" onClick={() => onStart(demo.id)}>
              <strong>{demo.business_name}</strong>
              <span className="portal-muted portal-small">
                {[demo.city, demo.portal_enabled ? "Portal on" : null].filter(Boolean).join(" · ")}
              </span>
            </button>
          </li>
        ))}
        {choices.length === 0 && <li className="portal-empty">No matches.</li>}
      </ul>
    </section>
  );
}

function Contracts({ data, open }) {
  const [starting, setStarting] = useState(false);
  const { contracts } = data;

  return (
    <div className="admin-stack">
      <section className="portal-card" aria-labelledby="contracts-title">
        <div className="portal-card-head">
          <h2 id="contracts-title">Projects under contract</h2>
          <button type="button" className="portal-button admin-small-button" onClick={() => setStarting(!starting)}>
            {starting ? "Close" : "New contract"}
          </button>
        </div>

        {contracts.length === 0 ? (
          <p className="portal-empty">No contracts yet. Use New contract to set up the agreement, costs and timeline for a client.</p>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th scope="col">Client</th>
                  <th scope="col">Status</th>
                  <th scope="col">Project</th>
                  <th scope="col">Monthly</th>
                  <th scope="col">Delivered</th>
                  <th scope="col">Client sees it</th>
                  <th scope="col">Updated</th>
                </tr>
              </thead>
              <tbody>
                {contracts.map((contract) => {
                  const { done, total } = deliveryCount(contract);
                  return (
                    <tr key={contract.id}>
                      <th scope="row">
                        <button type="button" className="portal-inline-link" onClick={() => open(`contract-${contract.demo_id}`)}>
                          {contract.business_name}
                        </button>
                        <span className="portal-muted portal-small">{contract.title}</span>
                      </th>
                      <td>
                        <span className={`portal-pill portal-pill-contract-${contract.status}`}>
                          {CONTRACT_LABELS[contract.status]}
                        </span>
                      </td>
                      <td className="portal-num">{money(projectTotal(contract))}</td>
                      <td className="portal-num">{contract.monthly_cents ? `${money(contract.monthly_cents)}/mo` : "–"}</td>
                      <td className="portal-num">{total ? `${done} / ${total}` : "–"}</td>
                      <td>
                        {contract.published && contract.portal_enabled
                          ? "Yes"
                          : contract.published
                            ? "Portal off"
                            : "Not yet"}
                      </td>
                      <td className="portal-muted">{formatDate(contract.updated_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {starting && (
        <NewContract demos={data.demos} contracts={contracts} onStart={(id) => open(`contract-${id}`)} />
      )}
    </div>
  );
}

function readView() {
  const view = window.location.hash.slice(1);
  return /^(overview|contracts|contract-\d+)$/.test(view) ? view : "overview";
}

function Dashboard({ data, setData, onSignOut }) {
  const [view, setView] = useState(readView);

  useEffect(() => {
    const onHash = () => setView(readView());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  function open(next) {
    window.location.hash = next;
    setView(next);
    window.scrollTo(0, 0);
  }

  const editingId = view.startsWith("contract-") ? view.slice("contract-".length) : null;
  const editingDemo = editingId && data.demos.find((demo) => String(demo.id) === editingId);
  const section = editingId ? "contracts" : view;

  return (
    <div className="portal-shell">
      <header className="portal-header">
        <div className="portal-header-inner">
          <a href="/admin/" className="portal-brand">
            <img src="/blueprint-webstudio-logo-text.png" alt="" />
            <span>Studio dashboard</span>
          </a>
          <div className="portal-header-side">
            <span className="portal-muted portal-small portal-hide-sm">{data.admin.email}</span>
            <button type="button" className="portal-ghost-button" onClick={onSignOut}>
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="portal-main">
        <nav className="admin-nav" aria-label="Dashboard">
          <button type="button" aria-current={section === "overview" ? "page" : undefined} onClick={() => open("overview")}>
            Overview
          </button>
          <button type="button" aria-current={section === "contracts" ? "page" : undefined} onClick={() => open("contracts")}>
            Contracts
            <span>{data.contracts.length}</span>
          </button>
          <a href="/review/">
            Concept reviews
            <span>{data.overview.concepts}</span>
          </a>
        </nav>

        {view === "overview" && <Overview data={data} open={open} />}
        {view === "contracts" && <Contracts data={data} open={open} />}
        {editingId &&
          (editingDemo ? (
            <ContractEditor
              key={editingId}
              demo={editingDemo}
              contract={data.contracts.find((contract) => String(contract.demo_id) === editingId) ?? null}
              files={data.files.filter((file) => String(file.demo_id) === editingId)}
              uploadLimit={data.uploadLimit}
              fileCategories={data.fileCategories}
              setData={setData}
              onClose={() => open("contracts")}
            />
          ) : (
            <p className="portal-empty">That client wasn't found.</p>
          ))}
      </main>
    </div>
  );
}

export default function Admin() {
  const [data, setData] = useState(null);
  const [gate, setGate] = useState(null);

  useEffect(() => {
    callAdmin({ action: "me" }).then((result) => {
      if (result.data?.admin) setData(result.data);
      else setGate({ needsSetup: Boolean(result.data?.needsSetup) });
    });
  }, []);

  async function signOut() {
    await callAdmin({ action: "signout" });
    setData(null);
    setGate({ needsSetup: false });
  }

  // Any action that finds the session gone drops back to sign-in
  function update(next) {
    if (next === null) {
      setData(null);
      setGate({ needsSetup: false });
    } else setData(next);
  }

  if (data) return <Dashboard data={data} setData={update} onSignOut={signOut} />;
  if (gate) return <SignIn needsSetup={gate.needsSetup} onSignedIn={setData} />;
  return (
    <main className="portal-gate">
      <p className="portal-loading">Loading…</p>
    </main>
  );
}
