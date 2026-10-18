import { sql } from "@vercel/postgres";
export async function ensureVASessionSchema() {
  await sql`CREATE TABLE IF NOT EXISTS va_sessions (
    token_hash TEXT PRIMARY KEY, va_id TEXT NOT NULL REFERENCES va_profiles(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL
  )`;
  await sql`CREATE INDEX IF NOT EXISTS va_sessions_expiry ON va_sessions(expires_at)`;
}
