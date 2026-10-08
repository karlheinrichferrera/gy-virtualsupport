import { sql } from "@vercel/postgres";

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
      bank_account_name TEXT NOT NULL DEFAULT ''
    )
  `;

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

  const { rows } = await sql`SELECT COUNT(*) as cnt FROM admin_accounts`;
  const count = parseInt(rows[0].cnt as string) || 0;
  if (count === 0) {
    await sql`INSERT INTO admin_accounts (username, password, display_name, created_at) VALUES ('admin', 'gyadmin2026', 'Administrator', 'System Default')`;
  }
}

export { sql };
