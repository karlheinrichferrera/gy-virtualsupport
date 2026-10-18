import { sql } from "@vercel/postgres";

/** Opaque sessions are revocable without storing browser tokens in the database. */
export async function ensureAdminSessionSchema() {
  await sql`
    CREATE TABLE IF NOT EXISTS admin_sessions (
      token_hash TEXT PRIMARY KEY,
      admin_id INTEGER NOT NULL REFERENCES admin_accounts(id) ON DELETE CASCADE,
      expires_at TIMESTAMPTZ NOT NULL
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS admin_sessions_expiration ON admin_sessions(expires_at)`;
  await sql`CREATE INDEX IF NOT EXISTS admin_sessions_admin ON admin_sessions(admin_id)`;
}
