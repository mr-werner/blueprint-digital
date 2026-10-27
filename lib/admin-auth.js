import { randomBytes } from "node:crypto";
import { hashToken } from "./portal-auth.js";

// Justin's own sign-in for /admin and /review, kept apart from client accounts
export const ADMIN_COOKIE = "bws_admin";
const SESSION_DAYS = 14;
export const MAX_FAILED_LOGINS = 5;
export const LOCK_MINUTES = 15;

export async function startAdminSession(sql, adminId) {
  const token = randomBytes(32).toString("base64url");

  await sql`
    INSERT INTO admin_sessions (token_hash, admin_id, expires_at)
    VALUES (${hashToken(token)}, ${adminId}, NOW() + make_interval(days => ${SESSION_DAYS}))
  `;

  return `${ADMIN_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}`;
}

export function clearedAdminCookie() {
  return `${ADMIN_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

function readAdminToken(req) {
  const header = req.headers?.cookie || "";
  for (const part of header.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === ADMIN_COOKIE) return rest.join("=") || null;
  }
  return null;
}

// The signed-in studio admin, or null
export async function currentAdmin(sql, req) {
  const token = readAdminToken(req);
  if (!token) return null;

  const rows = await sql`
    SELECT a.id, a.name, a.email
    FROM admin_sessions s
    JOIN admin_accounts a ON a.id = s.admin_id
    WHERE s.token_hash = ${hashToken(token)} AND s.expires_at > NOW()
    LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function endAdminSession(sql, req) {
  const token = readAdminToken(req);
  if (token) await sql`DELETE FROM admin_sessions WHERE token_hash = ${hashToken(token)}`;
}

// The review code (an is_admin row in demos); used to create the first login
// and handed to /review so its screenshot links keep working after a sign-in
export async function reviewCode(sql) {
  const rows = await sql`
    SELECT demo_code FROM demos
    WHERE is_admin = true AND status = 'active'
    ORDER BY id LIMIT 1
  `;
  return rows[0]?.demo_code ?? null;
}
