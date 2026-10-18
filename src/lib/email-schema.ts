import { sql } from "@vercel/postgres";
import { ensureEmailImageSchema } from "./email-image-schema";

export async function ensureEmailSchema() {
  await ensureEmailImageSchema();
  await sql`CREATE TABLE IF NOT EXISTS email_settings (
    singleton BOOLEAN PRIMARY KEY DEFAULT true CHECK (singleton),
    auto_invoices_since TIMESTAMPTZ,
    auto_notifications_since TIMESTAMPTZ
  )`;
  await sql`INSERT INTO email_settings(singleton) VALUES (true) ON CONFLICT DO NOTHING`;
  await sql`CREATE TABLE IF NOT EXISTS email_va_contacts (
    va_id TEXT PRIMARY KEY REFERENCES va_profiles(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    approved_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await sql`ALTER TABLE client_invoices ADD COLUMN IF NOT EXISTS email_published_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS email_queued_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS portal_notified_at TIMESTAMPTZ`;
  await sql`ALTER TABLE notifications ADD COLUMN IF NOT EXISTS email_queued_at TIMESTAMPTZ`;
  await sql`CREATE TABLE IF NOT EXISTS email_jobs (
    id SERIAL PRIMARY KEY,
    idempotency_key TEXT NOT NULL UNIQUE,
    connection_id UUID NOT NULL,
    to_emails JSONB NOT NULL,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    source TEXT NOT NULL CHECK (source IN ('manual','invoice','notification')),
    source_id INTEGER,
    status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sending','accepted','failed','uncertain','skipped','cancelled')),
    attempts INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    claimed_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    last_error TEXT
  )`;
  await sql`CREATE INDEX IF NOT EXISTS email_jobs_due ON email_jobs(available_at, id) WHERE status = 'queued'`;
  await sql`ALTER TABLE email_jobs
    ADD COLUMN IF NOT EXISTS cc_emails JSONB NOT NULL DEFAULT '[]',
    ADD COLUMN IF NOT EXISTS bcc_emails JSONB NOT NULL DEFAULT '[]',
    ADD COLUMN IF NOT EXISTS from_name TEXT NOT NULL DEFAULT 'GY Virtual Support Team',
    ADD COLUMN IF NOT EXISTS from_email TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS body_html TEXT,
    ADD COLUMN IF NOT EXISTS template_data JSONB,
    ADD COLUMN IF NOT EXISTS image_token UUID`;
  await sql`ALTER TABLE client_accounts ADD COLUMN IF NOT EXISTS invoice_cc TEXT NOT NULL DEFAULT ''`;
  await sql`CREATE TABLE IF NOT EXISTS email_migrations (name TEXT PRIMARY KEY)`;
  await sql`WITH migration AS (
    INSERT INTO email_migrations(name) VALUES ('devin-invoice-cc-v1') ON CONFLICT DO NOTHING RETURNING name
  ) UPDATE client_accounts SET invoice_cc='daisy@goldenyearsdesign.com, zanyette@goldenyearsdesign.com, bridget@goldenyearsdesign.com, karl@goldenyearsdesign.com'
    WHERE LOWER(email)='devin@goldenyearsdesign.com' AND invoice_cc='' AND EXISTS (SELECT 1 FROM migration)`;
}
