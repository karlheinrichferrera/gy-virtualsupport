import { sql } from "@vercel/postgres";

export type ApprovalStatus = "Pending" | "Approved" | "Denied";
export type ApprovalDetails = {
  requiresDualApproval?: boolean;
  adminApproval?: ApprovalStatus;
  clientApproval?: ApprovalStatus;
  adminRemarks?: string;
  clientRemarks?: string;
  adminApprovalAt?: string | null;
  clientApprovalAt?: string | null;
};
export function approvalDetails(row: Record<string, unknown>): ApprovalDetails {
  const iso = (value: unknown) => value ? new Date(value as string).toISOString() : null;
  return { requiresDualApproval: Boolean(row.requires_dual_approval),
    adminApproval: (row.admin_approval || "Pending") as ApprovalStatus,
    clientApproval: (row.client_approval || "Pending") as ApprovalStatus,
    adminRemarks: String(row.admin_remarks || ""), clientRemarks: String(row.client_remarks || ""),
    adminApprovalAt: iso(row.admin_approval_at), clientApprovalAt: iso(row.client_approval_at) };
}

export async function selectedRequestClient(vaId: string, requested?: number) {
  const { rows } = await sql`SELECT client_id FROM va_client_assignments WHERE va_id=${vaId}`;
  const id = requested || (rows.length === 1 ? Number(rows[0].client_id) : 0);
  if (!Number.isSafeInteger(id) || !rows.some(row => Number(row.client_id) === id)) {
    throw new Error("Select an assigned client for this request. Ask your administrator to check your client assignment if none is available.");
  }
  return id;
}

/** Locks one request, changes only the actor's decision, and publishes only full approval. */
export async function reviewRequest(kind: "leave" | "overtime", id: string | number, decision: ApprovalStatus,
  actor: { role: "admin" | "client"; name: string; clientId?: number }, remarks?: string) {
  if (!["Pending", "Approved", "Denied"].includes(decision)) throw new Error("Invalid approval decision.");
  if (remarks !== undefined && (typeof remarks !== "string" || remarks.length > 5000)) throw new Error("Enter remarks up to 5,000 characters.");
  const table = kind === "leave" ? "leave_requests" : "timeproof_entries";
  const column = kind === "leave" ? "request_id" : "id";
  const role = actor.role;
  if (role === "client" && (!Number.isSafeInteger(actor.clientId) || !actor.clientId)) throw new Error("Client sign-in required.");
  const approved = kind === "leave" ? "Approved" : "approved";
  const denied = kind === "leave" ? "Denied" : "rejected";
  const pending = kind === "leave" ? "Pending" : "pending";
  const result = await sql.query(`WITH previous AS MATERIALIZED (
    SELECT r.* FROM ${table} r WHERE r.${column}=$1 ${kind === "overtime" ? "AND r.entry_type='overtime'" : ""}
      AND ($5::integer IS NULL OR (r.client_id=$5 AND r.requires_dual_approval AND EXISTS
        (SELECT 1 FROM va_client_assignments a WHERE a.va_id=r.va_id AND a.client_id=$5))) FOR UPDATE
  ), decisions AS (
    SELECT previous.*,$6::text AS reviewer_role,${role === "admin" ? "$2::text" : "admin_approval"} AS next_admin,
      ${role === "client" ? "$2::text" : "client_approval"} AS next_client FROM previous
  ), changed AS (
    UPDATE ${table} r SET ${role}_approval=$2,${role}_approval_at=CASE WHEN $2='Pending' THEN NULL ELSE NOW() END,
      ${role}_approved_by=$3,${role}_remarks=COALESCE($4,previous.${role}_remarks),requires_dual_approval=true,
      status=CASE WHEN next_admin='Denied' OR next_client='Denied' THEN '${denied}'
        WHEN next_admin='Approved' AND next_client='Approved' AND previous.client_id IS NOT NULL THEN '${approved}' ELSE '${pending}' END
      ${kind === "leave" ? ",remarks=concat_ws(E'\\n',NULLIF(CASE WHEN $6='admin' THEN COALESCE($4,previous.admin_remarks) ELSE previous.admin_remarks END,''),NULLIF(CASE WHEN $6='client' THEN COALESCE($4,previous.client_remarks) ELSE previous.client_remarks END,''))" : ""}
    FROM decisions previous WHERE r.${column}=previous.${column}
    RETURNING r.*,previous.status AS previous_status
  ), notices AS (
    INSERT INTO notifications(va_id,audience,title,message,type,created_by,created_at,redirect_to)
    SELECT va_id,'va',${kind === "leave" ? "type || ' request approved'" : "'Overtime request approved'"},
      ${kind === "leave" ? "'Your ' || LOWER(type) || ' request (' || request_id || ') has been approved by both your client and an administrator.' || E'\\nPeriod: ' || date_from || ' to ' || date_to || CASE WHEN remarks!='' THEN E'\\nRemarks: ' || remarks ELSE '' END" : "'Your overtime request has been approved by both your client and an administrator.' || E'\\nDate: ' || punch_date || E'\\nTime: ' || time_in || ' to ' || time_out"},
      'request',$3,$7,${kind === "leave" ? "'/dashboard/requests'" : "'/dashboard/timeproof'"}
    FROM changed WHERE status='${approved}' AND previous_status!='${approved}' RETURNING id
  ) SELECT ${column} FROM changed`, [id, decision, actor.name, remarks ?? null, role === "client" ? actor.clientId : null, role, new Date().toISOString()]);
  if (!result.rows.length) throw new Error("Request not found or you do not have permission to review it.");
}
