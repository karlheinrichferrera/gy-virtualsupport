import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { sql } from "@vercel/postgres";
import { ensureClientSessionSchema } from "./client-session-schema";

const COOKIE = "gy_client_session";
const hash = (token: string) => createHash("sha256").update(token).digest("hex");
const valid = (token: string | undefined): token is string => Boolean(token && /^[a-f0-9]{64}$/.test(token));

export async function getClientSession(): Promise<{ id: number; email: string; displayName: string } | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!valid(token)) return null;
  await ensureClientSessionSchema();
  const { rows } = await sql`SELECT c.id,c.email,c.display_name FROM client_sessions s JOIN client_accounts c ON c.id=s.client_id
    WHERE s.token_hash=${hash(token)} AND s.expires_at>NOW()`;
  return rows.length ? { id: Number(rows[0].id), email: String(rows[0].email), displayName: String(rows[0].display_name) } : null;
}
export async function requireClientSession() {
  const session = await getClientSession();
  if (!session) throw new Error("Your client session has expired. Please sign in again.");
  return session;
}
export async function createClientSession(clientId: number) {
  await ensureClientSessionSchema();
  await clearClientSession();
  await sql`DELETE FROM client_sessions WHERE expires_at<=NOW()`;
  const token = randomBytes(32).toString("hex"), expires = new Date(Date.now() + 28800 * 1000);
  await sql`INSERT INTO client_sessions(token_hash,client_id,expires_at) VALUES (${hash(token)},${clientId},${expires.toISOString()})`;
  (await cookies()).set(COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 28800, expires });
}
export async function clearClientSession() {
  const store = await cookies(), token = store.get(COOKIE)?.value;
  try { if (valid(token)) await sql`DELETE FROM client_sessions WHERE token_hash=${hash(token)}`; }
  finally { store.set(COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 }); }
}
export async function invalidateClientSessions(clientId: number) {
  await ensureClientSessionSchema();
  await sql`DELETE FROM client_sessions WHERE client_id=${clientId}`;
}
