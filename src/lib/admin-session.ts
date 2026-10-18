import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { sql } from "@vercel/postgres";
import { ensureAdminSessionSchema } from "./admin-session-schema";

const COOKIE_NAME = "gy_admin_session";
const SESSION_SECONDS = 8 * 60 * 60;
const TOKEN_PATTERN = /^[a-f0-9]{64}$/;

export type AdminSession = {
  id: number;
  username: string;
  displayName: string;
};

let schemaReady: Promise<void> | undefined;

async function ensureSchema() {
  if (!schemaReady) {
    schemaReady = ensureAdminSessionSchema().catch(error => {
      schemaReady = undefined;
      throw error;
    });
  }
  await schemaReady;
}

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function getAdminSession(): Promise<AdminSession | null> {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token || !TOKEN_PATTERN.test(token)) return null;
  await ensureSchema();
  const { rows } = await sql`
    SELECT a.id, a.username, a.display_name
    FROM admin_sessions s
    JOIN admin_accounts a ON a.id = s.admin_id
    WHERE s.token_hash = ${tokenHash(token)} AND s.expires_at > NOW()
  `;
  if (!rows.length) return null;
  return {
    id: rows[0].id as number,
    username: rows[0].username as string,
    displayName: rows[0].display_name as string,
  };
}

export async function requireAdminSession(): Promise<AdminSession> {
  const session = await getAdminSession();
  if (!session) throw new Error("Your admin session has expired. Please sign in again.");
  return session;
}

/** Call only after verifying the admin's credentials, from a server action. */
export async function createAdminSession(adminId: number): Promise<void> {
  await ensureSchema();
  const cookieStore = await cookies();
  const previousToken = cookieStore.get(COOKIE_NAME)?.value;
  if (previousToken && TOKEN_PATTERN.test(previousToken)) {
    await sql`DELETE FROM admin_sessions WHERE token_hash = ${tokenHash(previousToken)}`;
  }
  await sql`DELETE FROM admin_sessions WHERE expires_at <= NOW()`;
  const token = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + SESSION_SECONDS * 1000);
  await sql`
    INSERT INTO admin_sessions(token_hash, admin_id, expires_at)
    VALUES (${tokenHash(token)}, ${adminId}, ${expires.toISOString()})
  `;
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_SECONDS,
    expires,
  });
}

export async function clearAdminSession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  try {
    if (token && TOKEN_PATTERN.test(token)) {
      await ensureSchema();
      await sql`DELETE FROM admin_sessions WHERE token_hash = ${tokenHash(token)}`;
    }
  } finally {
    cookieStore.set(COOKIE_NAME, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
  }
}

export async function invalidateAdminSessions(adminId: number): Promise<void> {
  await ensureSchema();
  await sql`DELETE FROM admin_sessions WHERE admin_id = ${adminId}`;
}
