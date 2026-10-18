import { sql } from "@vercel/postgres";
import type { LeaveRequest, SalaryAdjustment } from "./data";
import { reviewRequest, selectedRequestClient } from "./request-approvals";

export async function submitWorkflowRequest(vaId: string, request: LeaveRequest) {
  if (!["Leave", "Shift Adjustment"].includes(request.type) || request.status !== "Pending") throw new Error("Submit a pending leave or shift adjustment request.");
  const clientId = await selectedRequestClient(vaId, request.clientId);
  const { rows } = await sql`WITH submitted AS (
    INSERT INTO leave_requests(request_id,va_id,type,date_submitted,date_from,date_to,reason,status,remarks,client_id,requires_dual_approval,admin_approval,client_approval)
    VALUES (${request.id},${vaId},${request.type},${request.dateSubmitted},${request.dateFrom},${request.dateTo},${request.reason},'Pending','',${clientId},true,'Pending','Pending')
    ON CONFLICT (request_id) DO NOTHING RETURNING *
  ), receipts AS (
    INSERT INTO notifications(va_id,audience,title,message,type,created_by,created_at,redirect_to)
    SELECT va_id,'va',type || ' request received',
      'We have received your ' || LOWER(type) || ' request (' || request_id || '). It is pending review.' ||
      E'\nPeriod: ' || date_from || ' to ' || date_to,'request','system',${new Date().toISOString()},'/dashboard/requests'
    FROM submitted RETURNING id
  ), client_notices AS (
    INSERT INTO notifications(va_id,audience,client_id,title,message,type,created_by,created_at,redirect_to)
    SELECT '', 'client',s.client_id,s.type || ' request awaiting your approval',
      p.first_name || ' ' || p.last_name || ' submitted a ' || LOWER(s.type) || ' request (' || s.request_id || ').' ||
      E'\nPeriod: ' || s.date_from || ' to ' || s.date_to || E'\nReason: ' || s.reason ||
      E'\nPlease review this request. Both client and admin approval are required.',
      'request','system',${new Date().toISOString()},'/client/dashboard/requests'
    FROM submitted s JOIN va_profiles p ON p.id=s.va_id RETURNING id
  ) SELECT COUNT(*) AS count FROM receipts`;
  if (!Number(rows[0].count)) {
    const existing = await sql`SELECT va_id,type,date_from,date_to,reason,client_id FROM leave_requests WHERE request_id=${request.id}`;
    const row = existing.rows[0];
    if (!row || row.va_id !== vaId || row.type !== request.type || row.date_from !== request.dateFrom || row.date_to !== request.dateTo || row.reason !== request.reason || Number(row.client_id) !== clientId) {
      throw new Error("This request number is already in use. Refresh and submit again.");
    }
  }
}

export async function setWorkflowRequestStatus(id: string, status: LeaveRequest["status"], remarks: string | undefined, actor: string) {
  await reviewRequest("leave",id,status,{ role: "admin",name: actor },remarks);
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

export type OvertimeSubmission = { vaId: string; clientId: number; punchDate: string; timeIn: string; timeOut: string; notes: string; createdAt: string; status: string; submissionKey?: string; adminName?: string };
export async function submitOvertime(entry: OvertimeSubmission) {
  if (!["pending", "approved"].includes(entry.status)) throw new Error("Invalid overtime request status.");
  await sql`WITH submitted AS (
    INSERT INTO timeproof_entries(va_id,client_id,punch_date,time_in,time_out,notes,created_at,entry_type,status,submission_key,requires_dual_approval,admin_approval,client_approval,admin_approved_by,admin_approval_at)
    VALUES (${entry.vaId},${entry.clientId},${entry.punchDate},${entry.timeIn},${entry.timeOut},${entry.notes},${entry.createdAt},'overtime','pending',${entry.submissionKey ?? null},true,${entry.status === 'approved' ? 'Approved' : 'Pending'},'Pending',${entry.adminName || ''},CASE WHEN ${entry.status === 'approved'} THEN NOW() ELSE NULL END)
    ON CONFLICT (submission_key) DO NOTHING RETURNING *
  ), receipts AS (INSERT INTO notifications(va_id,audience,title,message,type,created_by,created_at,redirect_to)
    SELECT va_id,'va',CASE WHEN status='approved' THEN 'Overtime request approved' ELSE 'Overtime request received' END,
      CASE WHEN status='approved' THEN 'Your overtime request has been approved.' ELSE 'We have received your overtime request. It is pending review.' END ||
      E'\nDate: ' || punch_date || E'\nTime: ' || time_in || ' to ' || time_out,
      'request','system',${new Date().toISOString()},'/dashboard/timeproof' FROM submitted RETURNING id
  ) INSERT INTO notifications(va_id,audience,client_id,title,message,type,created_by,created_at,redirect_to)
    SELECT '','client',s.client_id,'Overtime request awaiting your approval',
      p.first_name || ' ' || p.last_name || ' submitted an overtime request.' || E'\nDate: ' || s.punch_date ||
      E'\nTime: ' || s.time_in || ' to ' || s.time_out || CASE WHEN s.notes!='' THEN E'\nNotes: ' || s.notes ELSE '' END ||
      E'\nPlease review this request. Both client and admin approval are required.',
      'request','system',${new Date().toISOString()},'/client/dashboard/requests?type=overtime'
    FROM submitted s JOIN va_profiles p ON p.id=s.va_id`;
}

export async function setOvertimeStatus(id: number, status: string, actor: string) {
  if (!["pending", "approved", "rejected"].includes(status)) throw new Error("Invalid overtime status.");
  await reviewRequest("overtime",id,status === "approved" ? "Approved" : status === "rejected" ? "Denied" : "Pending",{ role: "admin",name: actor });
}
