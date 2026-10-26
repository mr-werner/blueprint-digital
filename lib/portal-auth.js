import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);

export const SESSION_COOKIE = "bws_portal";
const SESSION_DAYS = 30;
const KEY_LENGTH = 64;

// Stored as "scrypt$<salt>$<hash>" so the format can change later
export async function hashPassword(password) {
  const salt = randomBytes(16).toString("base64url");
  const hash = await scryptAsync(password, salt, KEY_LENGTH);
  return `scrypt$${salt}$${hash.toString("base64url")}`;
}

export async function checkPassword(password, stored) {
  const [scheme, salt, expected] = String(stored || "").split("$");
  if (scheme !== "scrypt" || !salt || !expected) return false;

  const actual = await scryptAsync(password, salt, KEY_LENGTH);
  const wanted = Buffer.from(expected, "base64url");
  return wanted.length === actual.length && timingSafeEqual(wanted, actual);
}

export function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

// Creates a session row and returns the Set-Cookie header for it.
// Only the token's hash is stored, so a database leak can't sign anyone in.
export async function startSession(sql, accountId) {
  const token = randomBytes(32).toString("base64url");

  await sql`
    INSERT INTO client_sessions (token_hash, account_id, expires_at)
    VALUES (${hashToken(token)}, ${accountId}, NOW() + make_interval(days => ${SESSION_DAYS}))
  `;

  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}`;
}

export function clearedCookie() {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export function readSessionToken(req) {
  const header = req.headers?.cookie || "";
  for (const part of header.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === SESSION_COOKIE) return rest.join("=") || null;
  }
  return null;
}

// The signed-in account and its site, or null
export async function currentAccount(sql, req) {
  const token = readSessionToken(req);
  if (!token) return null;

  const rows = await sql`
    SELECT a.id, a.name, a.email, a.demo_id
    FROM client_sessions s
    JOIN client_accounts a ON a.id = s.account_id
    JOIN demos d ON d.id = a.demo_id
    WHERE s.token_hash = ${hashToken(token)}
      AND s.expires_at > NOW()
      AND a.disabled_at IS NULL
      AND d.status = 'active'
      AND d.portal_enabled = true
    LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function endSession(sql, req) {
  const token = readSessionToken(req);
  if (token) {
    await sql`DELETE FROM client_sessions WHERE token_hash = ${hashToken(token)}`;
  }
}
