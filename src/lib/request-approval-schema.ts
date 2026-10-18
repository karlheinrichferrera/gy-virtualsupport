import { sql } from "@vercel/postgres";

/** Existing completed outcomes stay historical; pending and new requests need both reviewers. */
export async function ensureRequestApprovalSchema() {
  await sql`ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS client_id INTEGER REFERENCES client_accounts(id) ON DELETE SET NULL`;
  for (const table of ["leave_requests", "timeproof_entries"]) {
    await sql.query(`ALTER TABLE ${table}
      ADD COLUMN IF NOT EXISTS requires_dual_approval BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS admin_approval TEXT,
      ADD COLUMN IF NOT EXISTS client_approval TEXT NOT NULL DEFAULT 'Pending',
      ADD COLUMN IF NOT EXISTS admin_approval_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS client_approval_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS admin_approved_by TEXT NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS client_approved_by TEXT NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS admin_remarks TEXT NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS client_remarks TEXT NOT NULL DEFAULT ''`);
    await sql.query(`UPDATE ${table} SET
      admin_approval=CASE LOWER(status) WHEN 'approved' THEN 'Approved' WHEN 'denied' THEN 'Denied' WHEN 'rejected' THEN 'Denied' ELSE 'Pending' END,
      requires_dual_approval=LOWER(status)='pending'${table === "leave_requests" ? ",admin_remarks=COALESCE(remarks,'')" : ""}
      WHERE admin_approval IS NULL ${table === "timeproof_entries" ? "AND entry_type='overtime'" : ""}`);
  }
  await sql`UPDATE leave_requests r SET client_id=a.client_id FROM
    (SELECT va_id,MIN(client_id) AS client_id FROM va_client_assignments GROUP BY va_id HAVING COUNT(*)=1) a
    WHERE r.va_id=a.va_id AND r.client_id IS NULL AND r.requires_dual_approval=true`;
}
