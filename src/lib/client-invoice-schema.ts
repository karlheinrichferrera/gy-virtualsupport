import { sql } from "@vercel/postgres";

export async function ensureClientInvoiceSchema() {
  await sql`ALTER TABLE client_accounts ADD COLUMN IF NOT EXISTS invoice_layout TEXT NOT NULL DEFAULT 'itemized'`;
  // This account preference persists when the client's name or login email changes.
  await sql`UPDATE client_accounts SET invoice_layout='legacy'
    WHERE LOWER(TRIM(email))='devin@goldenyearsdesign.com' AND invoice_layout!='legacy'`;
  // Existing invoices retain their layout; new invoices explicitly snapshot the account preference.
  await sql`ALTER TABLE client_invoices
    ADD COLUMN IF NOT EXISTS invoice_layout TEXT NOT NULL DEFAULT 'legacy',
    ADD COLUMN IF NOT EXISTS line_items JSONB NOT NULL DEFAULT '[]',
    ADD COLUMN IF NOT EXISTS payment_link TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS bill_to_name TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS bill_to_company TEXT NOT NULL DEFAULT ''`;
}
