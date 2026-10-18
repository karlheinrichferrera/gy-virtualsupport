import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { sql } from "@vercel/postgres";
import { ensureVASessionSchema } from "./va-session-schema";
import { getAdminSession } from "./admin-session";

const COOKIE = "gy_va_session";
const hash = (token: string) => createHash("sha256").update(token).digest("hex");
const valid = (token: string | undefined): token is string => Boolean(token && /^[a-f0-9]{64}$/.test(token));
export async function getVASession(): Promise<{ id: string } | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!valid(token)) return null;
  await ensureVASessionSchema();
  const { rows } = await sql`SELECT s.va_id FROM va_sessions s JOIN va_profiles v ON v.id=s.va_id
    WHERE token_hash=${hash(token)} AND expires_at>NOW()`;
  return rows.length ? { id: String(rows[0].va_id) } : null;
}
export async function requireVAOrAdmin(vaId: string) {
  const admin = await getAdminSession();
  if (admin) return admin;
  const va = await getVASession();
  if (!va || va.id !== vaId) throw new Error("Please sign in again to access your VA portal.");
  return null;
}
export async function createVASession(vaId: string) {
  await ensureVASessionSchema();
  await clearVASession();
  await sql`DELETE FROM va_sessions WHERE expires_at<=NOW()`;
  const token = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 8 * 60 * 60 * 1000);
  await sql`INSERT INTO va_sessions(token_hash,va_id,expires_at) VALUES (${hash(token)},${vaId},${expires.toISOString()})`;
  (await cookies()).set(COOKIE,token,{ httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 28800, expires });
}
export async function clearVASession() {
  const store = await cookies(), token = store.get(COOKIE)?.value;
  try { if (valid(token)) await sql`DELETE FROM va_sessions WHERE token_hash=${hash(token)}`; }
  finally { store.set(COOKIE,"",{ httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 }); }
}
export async function invalidateVASessions(vaId: string) {
  await ensureVASessionSchema();
  await sql`DELETE FROM va_sessions WHERE va_id=${vaId}`;
}
