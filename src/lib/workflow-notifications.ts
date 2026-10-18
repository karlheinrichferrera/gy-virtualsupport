import { sql } from "@vercel/postgres";
import type { LeaveRequest, SalaryAdjustment } from "./data";

export async function submitWorkflowRequest(vaId: string, request: LeaveRequest) {
  if (!["Leave", "Shift Adjustment"].includes(request.type) || request.status !== "Pending") throw new Error("Submit a pending leave or shift adjustment request.");
  const { rows } = await sql`WITH submitted AS (
    INSERT INTO leave_requests(request_id,va_id,type,date_submitted,date_from,date_to,reason,status,remarks)
    VALUES (${request.id},${vaId},${request.type},${request.dateSubmitted},${request.dateFrom},${request.dateTo},${request.reason},'Pending','')
    ON CONFLICT (request_id) DO NOTHING RETURNING *
  ), receipts AS (
    INSERT INTO notifications(va_id,audience,title,message,type,created_by,created_at,redirect_to)
    SELECT va_id,'va',type || ' request received',
      'We have received your ' || LOWER(type) || ' request (' || request_id || '). It is pending review.' ||
      E'\nPeriod: ' || date_from || ' to ' || date_to,'request','system',${new Date().toISOString()},'/dashboard/requests'
    FROM submitted RETURNING id
  ) SELECT COUNT(*) AS count FROM receipts`;
  if (!Number(rows[0].count)) {
    const existing = await sql`SELECT va_id,type,date_from,date_to,reason FROM leave_requests WHERE request_id=${request.id}`;
    const row = existing.rows[0];
    if (!row || row.va_id !== vaId || row.type !== request.type || row.date_from !== request.dateFrom || row.date_to !== request.dateTo || row.reason !== request.reason) {
      throw new Error("This request number is already in use. Refresh and submit again.");
    }
  }
}

export async function setWorkflowRequestStatus(id: string, status: LeaveRequest["status"], remarks: string | undefined, actor: string) {
  if (!["Pending", "Approved", "Denied"].includes(status)) throw new Error("Invalid request status.");
  await sql`WITH previous AS MATERIALIZED (SELECT * FROM leave_requests WHERE request_id=${id} FOR UPDATE),
  changed AS (
    UPDATE leave_requests r SET status=${status},remarks=COALESCE(${remarks ?? null},previous.remarks)
    FROM previous WHERE r.request_id=previous.request_id RETURNING r.*,previous.status AS previous_status
  ) INSERT INTO notifications(va_id,audience,title,message,type,created_by,created_at,redirect_to)
    SELECT va_id,'va',type || ' request approved',
      'Your ' || LOWER(type) || ' request (' || request_id || ') has been approved.' ||
      E'\nPeriod: ' || date_from || ' to ' || date_to || CASE WHEN remarks != '' THEN E'\nRemarks: ' || remarks ELSE '' END,
      'request',${actor},${new Date().toISOString()},'/dashboard/requests'
    FROM changed WHERE status='Approved' AND previous_status != 'Approved'`;
}

export async function recordSalaryAdjustment(vaId: string, adjustment: SalaryAdjustment, actor: string) {
  await sql`WITH adjustment AS (
    INSERT INTO salary_adjustments(va_id,effectivity_date,type,hourly_rate,sales_commission,referral_bonus,notes)
    VALUES (${vaId},${adjustment.effectivityDate},${adjustment.type},${adjustment.hourlyRate},${adjustment.salesCommission},${adjustment.referralBonus},${adjustment.notes})
    RETURNING *
  ) INSERT INTO notifications(va_id,audience,title,message,type,created_by,created_at,redirect_to)
    SELECT va_id,'va','New salary adjustment',
      'A new salary adjustment has been added to your account.' || E'\nEffective date: ' || effectivity_date ||
      E'\nAdjustment: ' || type || CASE WHEN hourly_rate != '' THEN E'\nHourly rate: ' || hourly_rate ELSE '' END ||
      CASE WHEN sales_commission != '' THEN E'\nSales commission: ' || sales_commission ELSE '' END ||
      CASE WHEN referral_bonus != '' THEN E'\nReferral bonus: ' || referral_bonus ELSE '' END ||
      CASE WHEN notes != '' THEN E'\nNotes: ' || notes ELSE '' END,
      'salary',${actor},${new Date().toISOString()},'/dashboard/adjustments' FROM adjustment`;
}

export type OvertimeSubmission = { vaId: string; clientId: number; punchDate: string; timeIn: string; timeOut: string; notes: string; createdAt: string; status: string; submissionKey?: string };
export async function submitOvertime(entry: OvertimeSubmission) {
  if (!["pending", "approved"].includes(entry.status)) throw new Error("Invalid overtime request status.");
  await sql`WITH submitted AS (
    INSERT INTO timeproof_entries(va_id,client_id,punch_date,time_in,time_out,notes,created_at,entry_type,status,submission_key)
    VALUES (${entry.vaId},${entry.clientId},${entry.punchDate},${entry.timeIn},${entry.timeOut},${entry.notes},${entry.createdAt},'overtime',${entry.status},${entry.submissionKey ?? null})
    ON CONFLICT (submission_key) DO NOTHING RETURNING *
  ) INSERT INTO notifications(va_id,audience,title,message,type,created_by,created_at,redirect_to)
    SELECT va_id,'va',CASE WHEN status='approved' THEN 'Overtime request approved' ELSE 'Overtime request received' END,
      CASE WHEN status='approved' THEN 'Your overtime request has been approved.' ELSE 'We have received your overtime request. It is pending review.' END ||
      E'\nDate: ' || punch_date || E'\nTime: ' || time_in || ' to ' || time_out,
      'request','system',${new Date().toISOString()},'/dashboard/timeproof' FROM submitted`;
}

export async function setOvertimeStatus(id: number, status: string, actor: string) {
  if (!["pending", "approved", "rejected"].includes(status)) throw new Error("Invalid overtime status.");
  await sql`WITH previous AS MATERIALIZED (SELECT * FROM timeproof_entries WHERE id=${id} FOR UPDATE),
  changed AS (
    UPDATE timeproof_entries e SET status=${status} FROM previous WHERE e.id=previous.id
    RETURNING e.*,previous.status AS previous_status
  ) INSERT INTO notifications(va_id,audience,title,message,type,created_by,created_at,redirect_to)
    SELECT va_id,'va','Overtime request approved','Your overtime request has been approved.' ||
      E'\nDate: ' || punch_date || E'\nTime: ' || time_in || ' to ' || time_out,
      'request',${actor},${new Date().toISOString()},'/dashboard/timeproof'
    FROM changed WHERE entry_type='overtime' AND status='approved' AND previous_status != 'approved'`;
}
