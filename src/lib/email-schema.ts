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
  await sql`ALTER TABLE client_accounts ADD COLUMN IF NOT EXISTS invoice_paypal_fees BOOLEAN NOT NULL DEFAULT false`;
  // A stored account preference retains Devin's exception when his login email changes.
  await sql`UPDATE client_accounts SET invoice_paypal_fees=true
    WHERE LOWER(TRIM(email))='devin@goldenyearsdesign.com' AND invoice_paypal_fees=false`;
  await sql`ALTER TABLE client_accounts ADD COLUMN IF NOT EXISTS request_notification_recipients TEXT`;
  // Set this account's initial request-email routing once; retain it if its login email changes.
  await sql`UPDATE client_accounts SET request_notification_recipients='zanyette@goldenyearsdesign.com,karl@goldenyearsdesign.com'
    WHERE LOWER(TRIM(email))='devin@goldenyearsdesign.com' AND request_notification_recipients IS NULL`;
  await sql`CREATE TABLE IF NOT EXISTS email_va_contacts (
    va_id TEXT PRIMARY KEY REFERENCES va_profiles(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    approved_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await sql`ALTER TABLE client_invoices ADD COLUMN IF NOT EXISTS email_published_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS email_queued_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS portal_notified_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS additional_recipients TEXT NOT NULL DEFAULT ''`;
  await sql`ALTER TABLE notifications ADD COLUMN IF NOT EXISTS email_queued_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS client_invoice_id INTEGER`;
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
    ADD COLUMN IF NOT EXISTS image_token UUID,
    ADD COLUMN IF NOT EXISTS client_invoice_id INTEGER,
    ADD COLUMN IF NOT EXISTS is_resend BOOLEAN NOT NULL DEFAULT false`;
  await sql`CREATE INDEX IF NOT EXISTS email_jobs_client_invoice_history ON email_jobs(client_invoice_id,id DESC) WHERE client_invoice_id IS NOT NULL`;
  await sql`CREATE INDEX IF NOT EXISTS email_jobs_invoice_history ON email_jobs(source_id,id DESC) WHERE source='invoice'`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS email_jobs_invoice_active ON email_jobs(source_id)
    WHERE source='invoice' AND status IN ('queued','sending')`;
  // Upgrade unsent legacy snapshots without changing completed email history or retrying delivery.
  await sql`UPDATE email_jobs j SET template_data=j.template_data || jsonb_build_object('includesPayPalFees',c.invoice_paypal_fees)
    FROM client_invoices i JOIN client_accounts c ON c.id=i.client_id
    WHERE j.source='invoice' AND j.source_id=i.id AND j.status IN ('queued','failed','uncertain')
      AND j.template_data->>'kind'='invoice' AND NOT (j.template_data ? 'includesPayPalFees')`;
}
