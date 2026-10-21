import { sql } from "@vercel/postgres";
import { ensureNotificationSchema } from "./notification-schema";
import { ensureAdminSessionSchema } from "./admin-session-schema";
import { ensureOutlookSchema } from "./outlook-schema";
import { ensureEmailSchema } from "./email-schema";
import { ensureVASessionSchema } from "./va-session-schema";
import { ensureClientSessionSchema } from "./client-session-schema";
import { ensureRequestApprovalSchema } from "./request-approval-schema";
import { ensureClientInvoiceSchema } from "./client-invoice-schema";

export async function ensureTables() {
  await sql`
    CREATE TABLE IF NOT EXISTS va_profiles (
      id TEXT PRIMARY KEY,
      first_name TEXT NOT NULL DEFAULT '',
      middle_name TEXT NOT NULL DEFAULT '',
      last_name TEXT NOT NULL DEFAULT '',
      suffix TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      alt_phone TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT '',
      date_of_birth TEXT NOT NULL DEFAULT '',
      addr_street TEXT NOT NULL DEFAULT '',
      addr_subdivision TEXT NOT NULL DEFAULT '',
      addr_barangay TEXT NOT NULL DEFAULT '',
      addr_city TEXT NOT NULL DEFAULT '',
      addr_province TEXT NOT NULL DEFAULT '',
      addr_postal_code TEXT NOT NULL DEFAULT '',
      temporary_address TEXT NOT NULL DEFAULT '',
      position TEXT NOT NULL DEFAULT '',
      employment_status TEXT NOT NULL DEFAULT '',
      date_hired TEXT NOT NULL DEFAULT '',
      current_rate TEXT NOT NULL DEFAULT '',
      emergency_contact TEXT NOT NULL DEFAULT '',
      emergency_phone TEXT NOT NULL DEFAULT '',
      password TEXT NOT NULL DEFAULT 'gyva2026',
      contractor_id TEXT NOT NULL DEFAULT '',
      payout_mode TEXT NOT NULL DEFAULT '',
      paypal_link TEXT NOT NULL DEFAULT '',
      ewallet_name TEXT NOT NULL DEFAULT '',
      ewallet_number TEXT NOT NULL DEFAULT '',
      bank_name TEXT NOT NULL DEFAULT '',
      bank_account_number TEXT NOT NULL DEFAULT '',
      bank_account_name TEXT NOT NULL DEFAULT '',
      weekly_report_link TEXT NOT NULL DEFAULT ''
    )
  `;

  await ensureVASessionSchema();
  await sql`ALTER TABLE va_profiles ADD COLUMN IF NOT EXISTS weekly_report_link TEXT NOT NULL DEFAULT ''`;
  await sql`ALTER TABLE va_profiles ADD COLUMN IF NOT EXISTS profile_picture TEXT NOT NULL DEFAULT ''`;
  await sql`ALTER TABLE va_profiles ADD COLUMN IF NOT EXISTS work_schedule TEXT NOT NULL DEFAULT ''`;
  await sql`ALTER TABLE va_profiles ADD COLUMN IF NOT EXISTS last_active TIMESTAMPTZ`;

  await sql`
    CREATE TABLE IF NOT EXISTS salary_adjustments (
      id SERIAL PRIMARY KEY,
      va_id TEXT NOT NULL REFERENCES va_profiles(id) ON DELETE CASCADE,
      effectivity_date TEXT NOT NULL DEFAULT '',
      type TEXT NOT NULL DEFAULT '',
      hourly_rate TEXT NOT NULL DEFAULT '',
      sales_commission TEXT NOT NULL DEFAULT '',
      referral_bonus TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT ''
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS invoices (
      id SERIAL PRIMARY KEY,
      va_id TEXT NOT NULL REFERENCES va_profiles(id) ON DELETE CASCADE,
      invoice_number TEXT NOT NULL DEFAULT '',
      date_covered TEXT NOT NULL DEFAULT '',
      amount TEXT NOT NULL DEFAULT '',
      transaction_fee TEXT NOT NULL DEFAULT '',
      amount_disbursed TEXT NOT NULL DEFAULT '',
      invoice_copy TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT ''
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS leave_requests (
      request_id TEXT PRIMARY KEY,
      va_id TEXT NOT NULL REFERENCES va_profiles(id) ON DELETE CASCADE,
      type TEXT NOT NULL DEFAULT '',
      date_submitted TEXT NOT NULL DEFAULT '',
      date_from TEXT NOT NULL DEFAULT '',
      date_to TEXT NOT NULL DEFAULT '',
      reason TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'Pending',
      remarks TEXT NOT NULL DEFAULT ''
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS admin_accounts (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      display_name TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT ''
    )
  `;

  await ensureAdminSessionSchema();
  const { rows } = await sql`SELECT COUNT(*) as cnt FROM admin_accounts`;
  const count = parseInt(rows[0].cnt as string) || 0;
  if (count === 0) {
    await sql`INSERT INTO admin_accounts (username, password, display_name, created_at) VALUES ('admin', 'gyadmin2026', 'Administrator', 'System Default')`;
  }

  await sql`
    CREATE TABLE IF NOT EXISTS client_accounts (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL DEFAULT 'gyclient2026',
      display_name TEXT NOT NULL DEFAULT '',
      company_name TEXT NOT NULL DEFAULT '',
      address TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT ''
    )
  `;

  const cr = await sql`SELECT COUNT(*) as cnt FROM client_accounts`;
  const clientCount = parseInt(cr.rows[0].cnt as string) || 0;
  if (clientCount === 0) {
    await sql`INSERT INTO client_accounts (email, password, display_name, created_at) VALUES ('devin@goldenyearsdesign.com', 'gyclient2026', 'Devin Rubin', 'System Default')`;
  }

  await sql`ALTER TABLE client_accounts ADD COLUMN IF NOT EXISTS client_code TEXT NOT NULL DEFAULT ''`;
  await sql`ALTER TABLE client_accounts ADD COLUMN IF NOT EXISTS company_name TEXT NOT NULL DEFAULT ''`;
  await sql`ALTER TABLE client_accounts ADD COLUMN IF NOT EXISTS address TEXT NOT NULL DEFAULT ''`;
  await sql`ALTER TABLE client_accounts ADD COLUMN IF NOT EXISTS phone TEXT NOT NULL DEFAULT ''`;
  await sql`ALTER TABLE client_accounts ADD COLUMN IF NOT EXISTS timesheet_url TEXT NOT NULL DEFAULT ''`;
  await sql`ALTER TABLE client_accounts ADD COLUMN IF NOT EXISTS timesheet_view_url TEXT NOT NULL DEFAULT ''`;

  await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS client_id INTEGER DEFAULT 0`;
  await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS submission_key UUID UNIQUE`;

  await sql`
    CREATE TABLE IF NOT EXISTS va_client_assignments (
      id SERIAL PRIMARY KEY,
      va_id TEXT NOT NULL REFERENCES va_profiles(id) ON DELETE CASCADE,
      client_id INTEGER NOT NULL REFERENCES client_accounts(id) ON DELETE CASCADE,
      UNIQUE(va_id, client_id)
    )
  `;

  await sql`ALTER TABLE va_client_assignments ADD COLUMN IF NOT EXISTS client_rate TEXT NOT NULL DEFAULT ''`;
  await sql`ALTER TABLE va_client_assignments ADD COLUMN IF NOT EXISTS report_url TEXT NOT NULL DEFAULT ''`;
  await sql`ALTER TABLE va_client_assignments ADD COLUMN IF NOT EXISTS report_view_url TEXT NOT NULL DEFAULT ''`;

  await sql`
    CREATE TABLE IF NOT EXISTS timeproof_entries (
      id SERIAL PRIMARY KEY,
      va_id TEXT NOT NULL REFERENCES va_profiles(id) ON DELETE CASCADE,
      client_id INTEGER NOT NULL REFERENCES client_accounts(id) ON DELETE CASCADE,
      punch_date TEXT NOT NULL DEFAULT '',
      time_in TEXT NOT NULL DEFAULT '',
      time_out TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT ''
    )
  `;

  await sql`ALTER TABLE timeproof_entries ADD COLUMN IF NOT EXISTS entry_type TEXT NOT NULL DEFAULT 'time'`;
  await sql`ALTER TABLE timeproof_entries ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'approved'`;
  await sql`ALTER TABLE timeproof_entries ADD COLUMN IF NOT EXISTS submission_key UUID UNIQUE`;

  await sql`
    CREATE TABLE IF NOT EXISTS client_salary_adjustments (
      id SERIAL PRIMARY KEY,
      client_id INTEGER NOT NULL REFERENCES client_accounts(id) ON DELETE CASCADE,
      va_id TEXT NOT NULL REFERENCES va_profiles(id) ON DELETE CASCADE,
      effectivity_date TEXT NOT NULL DEFAULT '',
      type TEXT NOT NULL DEFAULT '',
      hourly_rate TEXT NOT NULL DEFAULT '',
      sales_commission TEXT NOT NULL DEFAULT '',
      referral_bonus TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT ''
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS client_invoices (
      id SERIAL PRIMARY KEY,
      client_id INTEGER NOT NULL REFERENCES client_accounts(id) ON DELETE CASCADE,
      invoice_number TEXT NOT NULL DEFAULT '',
      bill_coverage TEXT NOT NULL DEFAULT '',
      amount TEXT NOT NULL DEFAULT '',
      invoice_due_date TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'Pending',
      invoice_link TEXT NOT NULL DEFAULT ''
    )
  `;
  await sql`ALTER TABLE client_invoices ADD COLUMN IF NOT EXISTS client_id INTEGER DEFAULT 0`;
  await sql`
    CREATE TABLE IF NOT EXISTS calendar_events (
      id SERIAL PRIMARY KEY,
      event_date TEXT NOT NULL DEFAULT '',
      title TEXT NOT NULL DEFAULT '',
      event_type TEXT NOT NULL DEFAULT 'event',
      created_at TEXT NOT NULL DEFAULT ''
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS notifications (
      id SERIAL PRIMARY KEY,
      va_id TEXT NOT NULL DEFAULT '',
      title TEXT NOT NULL DEFAULT '',
      message TEXT NOT NULL DEFAULT '',
      type TEXT NOT NULL DEFAULT 'general',
      is_read BOOLEAN NOT NULL DEFAULT false,
      created_at TEXT NOT NULL DEFAULT '',
      created_by TEXT NOT NULL DEFAULT 'system'
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS notification_reads (
      id SERIAL PRIMARY KEY,
      notification_id INTEGER NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
      va_id TEXT NOT NULL,
      UNIQUE(notification_id, va_id)
    )
  `;
  await ensureNotificationSchema();
  await ensureOutlookSchema();
  await ensureEmailSchema();
  await ensureClientInvoiceSchema();
  await ensureClientSessionSchema();
  await ensureRequestApprovalSchema();
}

export { sql };
