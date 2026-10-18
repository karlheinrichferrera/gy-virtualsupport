import { sql } from "@vercel/postgres";

/** Outlook credentials stay encrypted; disconnect preserves a tombstone for OAuth/refresh CAS. */
export async function ensureOutlookSchema() {
  await sql`
    CREATE TABLE IF NOT EXISTS outlook_connection (
      singleton BOOLEAN PRIMARY KEY DEFAULT true CHECK (singleton),
      connection_id UUID NOT NULL,
      version INTEGER NOT NULL DEFAULT 0,
      encrypted_tokens TEXT,
      access_expires_at TIMESTAMPTZ,
      sender_email TEXT,
      sender_name TEXT,
      last_error TEXT,
      refresh_lock UUID,
      refresh_lock_expires_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS outlook_oauth_states (
      state_hash TEXT PRIMARY KEY,
      admin_id TEXT NOT NULL,
      code_verifier_encrypted TEXT NOT NULL,
      expected_connection_id UUID NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS outlook_oauth_states_expiration ON outlook_oauth_states(expires_at)`;
}
