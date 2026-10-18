import { sql } from "@vercel/postgres";

export async function ensureClientSessionSchema() {
  await sql`CREATE TABLE IF NOT EXISTS client_sessions (
    token_hash TEXT PRIMARY KEY, client_id INTEGER NOT NULL REFERENCES client_accounts(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL
  )`;
  await sql`CREATE INDEX IF NOT EXISTS client_sessions_expiry ON client_sessions(expires_at)`;
}
