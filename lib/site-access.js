// Turns a concept site's subdomain off and back on without touching its
// repo, code or deployments. Closing adds (or re-activates) one Vercel
// Firewall rule on the concept's project that redirects every request,
// pages and files alike, on every hostname (the custom subdomain and the
// *.vercel.app addresses) to /unavailable on the studio site. Reopening
// switches that rule off. Needs VERCEL_API_TOKEN (team access) in the
// blueprint-digital project; VERCEL_TEAM_ID is optional.

const API = "https://api.vercel.com";
const DEFAULT_TEAM = "team_tW7QpwO2dpv7uR8dQYVNhzLD";
const RULE_NAME = "Concept closed";
export const CLOSED_PAGE = "https://www.blueprintwebstudio.com/unavailable/";

export class SiteAccessError extends Error {}

function teamId() {
  return process.env.VERCEL_TEAM_ID || DEFAULT_TEAM;
}

async function vercel(path, { method = "GET", body, query = {} } = {}) {
  const token = process.env.VERCEL_API_TOKEN;
  if (!token) {
    throw new SiteAccessError(
      "Add a VERCEL_API_TOKEN environment variable to the blueprint-digital Vercel project to use this switch."
    );
  }

  const url = new URL(path, API);
  url.searchParams.set("teamId", teamId());
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);

  const response = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, data };
}

function hostOf(url) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Finds the Vercel project that serves this demo's subdomain
async function findProject(demo) {
  const host = hostOf(demo.demo_url);
  if (!host) throw new SiteAccessError("This concept has no site address.");

  // Most projects are named after the business in kebab-case
  const guess = slugify(demo.business_name);
  if (guess) {
    const hit = await vercel(`/v9/projects/${guess}/domains/${host}`);
    if (hit.ok && hit.data.projectId) return hit.data.projectId;
  }

  // Otherwise look through every project's domains
  let from;
  for (let page = 0; page < 10; page += 1) {
    const list = await vercel("/v9/projects", {
      query: { limit: "100", ...(from ? { from: String(from) } : {}) },
    });
    if (!list.ok) break;
    for (const project of list.data.projects ?? []) {
      const aliases = [
        ...(project.alias ?? []).map((entry) => entry.domain ?? entry),
        ...(project.targets?.production?.alias ?? []),
      ].map((value) => String(value).toLowerCase());
      if (aliases.includes(host)) return project.id;
      const domain = await vercel(`/v9/projects/${project.id}/domains/${host}`);
      if (domain.ok && domain.data.projectId) return domain.data.projectId;
    }
    from = list.data.pagination?.next;
    if (!from) break;
  }

  throw new SiteAccessError(`Couldn't find the Vercel project for ${host}.`);
}

function closedRule(active) {
  return {
    name: RULE_NAME,
    description: "Blueprint WebStudio: site access turned off from the Review page.",
    active,
    conditionGroup: [{ conditions: [{ type: "path", op: "pre", value: "/" }] }],
    action: {
      mitigate: { action: "redirect", redirect: { location: CLOSED_PAGE, permanent: false } },
    },
  };
}

async function patchFirewall(projectId, body) {
  const result = await vercel("/v1/security/firewall/config", {
    method: "PATCH",
    query: { projectId },
    body,
  });
  if (!result.ok) {
    console.error("Vercel firewall update failed:", result.status, result.data);
    throw new SiteAccessError("Vercel didn't accept the change. Try again in a minute.");
  }
}

// open = true reopens the site; false closes it. Returns the project id.
export async function setSiteAccess(demo, open) {
  const projectId = demo.vercel_project_id || (await findProject(demo));

  const current = await vercel("/v1/security/firewall/config/active", { query: { projectId } });
  const rule = current.ok
    ? (current.data.rules ?? []).find((entry) => entry.name === RULE_NAME)
    : null;

  if (rule) {
    await patchFirewall(projectId, { action: "rules.update", id: rule.id, value: closedRule(!open) });
  } else if (!open) {
    await patchFirewall(projectId, { action: "rules.insert", id: null, value: closedRule(true) });
  }

  // Custom rules only run while the project's firewall is on
  if (!open && (!current.ok || current.data.firewallEnabled === false)) {
    await patchFirewall(projectId, { action: "firewallEnabled", id: null, value: true });
  }

  return projectId;
}
