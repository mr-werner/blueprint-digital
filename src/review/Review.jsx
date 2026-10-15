import { useEffect, useState } from "react";

const STORAGE_KEY = "bws-review-code";

function hostOf(url) {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function formatDate(value) {
  if (!value) return null;
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
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

  // Asks the server for the concept list; returns either demos or an error message
  async function requestDemos(submittedCode) {
    try {
      const response = await fetch("/api/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: submittedCode }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.success) {
        storeCode("");
        return { error: data.message || "That review code isn't valid." };
      }

      storeCode(submittedCode);
      return { demos: data.demos };
    } catch (lookupError) {
      console.error("Review lookup error:", lookupError);
      return {
        error: "We couldn't load the review page right now. Please try again.",
      };
    }
  }

  function applyResult(result) {
    setLoading(false);
    if (result.demos) setDemos(result.demos);
    else setError(result.error);
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
  const visible = demos.filter((demo) =>
    [demo.business_name, demo.category, demo.city, demo.demo_url]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(query)
  );
  const activeCount = demos.filter((demo) => demo.status === "active").length;
  const viewedCount = demos.filter((demo) => demo.view_count > 0).length;

  return (
    <main className="review-page">
      <header className="review-header">
        <div>
          <p className="review-kicker">Blueprint WebStudio · Internal</p>
          <h1>Concept review</h1>
          <p className="review-summary">
            {demos.length} concepts · {activeCount} active · {viewedCount}{" "}
            opened by a client
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

      <ul className="review-grid">
        {visible.map((demo) => (
          <li key={demo.id} className="review-card">
            <div className="review-card-top">
              <p className="review-meta">
                {[demo.category, demo.city].filter(Boolean).join(" · ") ||
                  "Concept"}
              </p>
              <span
                className={`review-status review-status-${demo.status}`}
                title={`Status in Neon: ${demo.status}`}
              >
                {demo.status}
              </span>
            </div>

            <h2>{demo.business_name}</h2>

            {demo.background && (
              <p className="review-background">{demo.background}</p>
            )}

            <div className="review-links">
              <a
                href={demo.demo_url}
                target="_blank"
                rel="noreferrer"
                className="review-link review-link-primary"
              >
                <span className="review-link-label">Concept</span>
                <span className="review-link-url">{hostOf(demo.demo_url)}</span>
              </a>

              {demo.original_url ? (
                <a
                  href={demo.original_url}
                  target="_blank"
                  rel="noreferrer"
                  className="review-link"
                >
                  <span className="review-link-label">Original site</span>
                  <span className="review-link-url">
                    {hostOf(demo.original_url)}
                  </span>
                </a>
              ) : (
                <span className="review-link review-link-empty">
                  <span className="review-link-label">Original site</span>
                  <span className="review-link-url">Not on file</span>
                </span>
              )}
            </div>

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
          </li>
        ))}
      </ul>

      {visible.length === 0 && (
        <p className="review-empty">No concepts match “{filter}”.</p>
      )}
    </main>
  );
}
