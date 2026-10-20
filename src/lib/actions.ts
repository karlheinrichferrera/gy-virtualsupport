"use server";

import { sql } from "@vercel/postgres";
import * as notificationService from "./notifications";
import type { NotificationInput } from "./notification-types";
import { beginImageUpload, appendImageChunk } from "./notification-image-storage";
import type { VAProfile, SalaryAdjustment, Invoice, LeaveRequest } from "./data";
import { estDate, estDateLong } from "./est";
import { clearAdminSession, createAdminSession, getAdminSession, invalidateAdminSessions, requireAdminSession } from "./admin-session";
import { wakeEmailDelivery } from "./email-dispatch";
import { approveVAEmail } from "./email-service";
import { parseEmailAddresses } from "./email-addresses";
import { getVASession, requireVAOrAdmin, createVASession, clearVASession, invalidateVASessions } from "./va-session";
import { submitWorkflowRequest, setWorkflowRequestStatus, recordSalaryAdjustment, submitOvertime, setOvertimeStatus } from "./workflow-notifications";
import { submitVAInvoice, saveVAInvoice } from "./va-invoices";
import type { EmailJobStatus } from "./email-types";
import { createClientSession, clearClientSession, getClientSession, requireClientSession, invalidateClientSessions } from "./client-session";
import { approvalDetails, selectedRequestClient, reviewRequest, type ApprovalDetails } from "./request-approvals";
import { invoiceItems, invoicePaymentLink, validateItemizedInvoiceDetails, DEFAULT_INVOICE_PAYMENT_LINK, type InvoiceLayout, type InvoiceLineItem } from "./client-invoice-format";


let tablesReady = false;
let tablesPending: Promise<void> | undefined;
async function ensureTablesOnce() {
  if (tablesReady) return;
  if (!tablesPending) {
    tablesPending = (async () => {
      const { ensureTables } = await import("./db");
      await ensureTables();
      tablesReady = true;
    })().catch(error => {
      tablesPending = undefined;
      throw error;
    });
  }
  await tablesPending;
}

function rowToProfile(r: Record<string, unknown>): VAProfile {
  return {
    id: r.id as string,
    firstName: r.first_name as string,
    middleName: r.middle_name as string,
    lastName: r.last_name as string,
    suffix: r.suffix as string,
    phone: r.phone as string,
    altPhone: r.alt_phone as string,
    email: r.email as string,
    dateOfBirth: r.date_of_birth as string,
    permanentAddress: {
      street: r.addr_street as string,
      subdivision: r.addr_subdivision as string,
      barangay: r.addr_barangay as string,
      city: r.addr_city as string,
      province: r.addr_province as string,
      postalCode: r.addr_postal_code as string,
    },
    temporaryAddress: r.temporary_address as string,
    position: r.position as string,
    employmentStatus: r.employment_status as string,
    dateHired: r.date_hired as string,
    currentRate: r.current_rate as string,
    emergencyContact: r.emergency_contact as string,
    emergencyPhone: r.emergency_phone as string,
    password: "",
    contractorId: r.contractor_id as string,
    payoutMode: r.payout_mode as string,
    paypalLink: r.paypal_link as string,
    ewalletName: r.ewallet_name as string,
    ewalletNumber: r.ewallet_number as string,
    bankName: r.bank_name as string,
    bankAccountNumber: r.bank_account_number as string,
    bankAccountName: r.bank_account_name as string,
    weeklyReportLink: (r.weekly_report_link as string) || "",
    profilePicture: (r.profile_picture as string) || "",
    workSchedule: parseWorkSchedule((r.work_schedule as string) || ""),
  };
}

const DEFAULT_SCHEDULE: VAProfile["workSchedule"] = {
  monday: { enabled: false, start: "", end: "" },
  tuesday: { enabled: false, start: "", end: "" },
  wednesday: { enabled: false, start: "", end: "" },
  thursday: { enabled: false, start: "", end: "" },
  friday: { enabled: false, start: "", end: "" },
  saturday: { enabled: false, start: "", end: "" },
  sunday: { enabled: false, start: "", end: "" },
};

function parseWorkSchedule(raw: string): VAProfile["workSchedule"] {
  if (!raw) return { ...DEFAULT_SCHEDULE };
  try {
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_SCHEDULE, ...parsed };
  } catch {
    return { ...DEFAULT_SCHEDULE };
  }
}

function rowToAdjustment(r: Record<string, unknown>): SalaryAdjustment & { id: number } {
  return {
    id: r.id as number,
    effectivityDate: r.effectivity_date as string,
    type: r.type as string,
    hourlyRate: r.hourly_rate as string,
    salesCommission: r.sales_commission as string,
    referralBonus: r.referral_bonus as string,
    notes: r.notes as string,
  };
}

function rowToInvoice(r: Record<string, unknown>): Invoice {
  return {
    invoiceNumber: r.invoice_number as string,
    clientId: (r.client_id as number) || 0,
    dateCovered: r.date_covered as string,
    amount: r.amount as string,
    transactionFee: r.transaction_fee as string,
    amountDisbursed: r.amount_disbursed as string,
    invoiceCopy: r.invoice_copy as string,
    status: r.status as Invoice["status"],
  };
}

function rowToRequest(r: Record<string, unknown>): LeaveRequest {
  return {
    ...approvalDetails(r),
    clientId: r.client_id == null ? undefined : Number(r.client_id),
    clientName: String(r.client_name || ""),
    id: r.request_id as string,
    type: r.type as LeaveRequest["type"],
    dateSubmitted: r.date_submitted as string,
    dateFrom: r.date_from as string,
    dateTo: r.date_to as string,
    reason: r.reason as string,
    status: r.status as LeaveRequest["status"],
    remarks: r.remarks as string,
  };
}

// ── Profiles ──

export async function getProfiles(): Promise<VAProfile[]> {
  await ensureTablesOnce();
  const { rows } = await sql`SELECT * FROM va_profiles ORDER BY id`;
  return rows.map(rowToProfile);
}

export async function getProfile(id: string): Promise<VAProfile | undefined> {
  await ensureTablesOnce();
  const { rows } = await sql`SELECT * FROM va_profiles WHERE id = ${id}`;
  return rows.length > 0 ? rowToProfile(rows[0]) : undefined;
}

export async function addProfile(p: VAProfile): Promise<void> {
  await ensureTablesOnce();
  await sql`
    INSERT INTO va_profiles (
      id, first_name, middle_name, last_name, suffix,
      phone, alt_phone, email, date_of_birth,
      addr_street, addr_subdivision, addr_barangay, addr_city, addr_province, addr_postal_code,
      temporary_address, position, employment_status, date_hired, current_rate,
      emergency_contact, emergency_phone, password, contractor_id,
      payout_mode, paypal_link, ewallet_name, ewallet_number,
      bank_name, bank_account_number, bank_account_name, weekly_report_link, profile_picture, work_schedule
    ) VALUES (
      ${p.id}, ${p.firstName}, ${p.middleName}, ${p.lastName}, ${p.suffix},
      ${p.phone}, ${p.altPhone}, ${p.email}, ${p.dateOfBirth},
      ${p.permanentAddress.street}, ${p.permanentAddress.subdivision}, ${p.permanentAddress.barangay},
      ${p.permanentAddress.city}, ${p.permanentAddress.province}, ${p.permanentAddress.postalCode},
      ${p.temporaryAddress}, ${p.position}, ${p.employmentStatus}, ${p.dateHired}, ${p.currentRate},
      ${p.emergencyContact}, ${p.emergencyPhone}, ${p.password}, ${p.contractorId},
      ${p.payoutMode}, ${p.paypalLink}, ${p.ewalletName}, ${p.ewalletNumber},
      ${p.bankName}, ${p.bankAccountNumber}, ${p.bankAccountName}, ${p.weeklyReportLink || ""}, ${p.profilePicture || ""},
      ${JSON.stringify(p.workSchedule || DEFAULT_SCHEDULE)}
    )
  `;
  if (await getAdminSession()) await approveVAEmail(p.id, p.email);
}

export async function updateProfile(id: string, updates: Partial<VAProfile>): Promise<void> {
  const admin = await requireVAOrAdmin(id);
  await ensureTablesOnce();
  const { rows } = await sql`SELECT * FROM va_profiles WHERE id=${id}`;
  if (!rows.length) return;
  if (updates.password !== undefined && !admin) throw new Error("Use Change Password in Settings to change your password.");
  const current = { ...rowToProfile(rows[0]), password: String(rows[0].password) };
  const merged = { ...current, ...updates };
  const addr = updates.permanentAddress
    ? { ...current.permanentAddress, ...updates.permanentAddress }
    : current.permanentAddress;

  await sql`
    UPDATE va_profiles SET
      first_name = ${merged.firstName},
      middle_name = ${merged.middleName},
      last_name = ${merged.lastName},
      suffix = ${merged.suffix},
      phone = ${merged.phone},
      alt_phone = ${merged.altPhone},
      email = ${merged.email},
      date_of_birth = ${merged.dateOfBirth},
      addr_street = ${addr.street},
      addr_subdivision = ${addr.subdivision},
      addr_barangay = ${addr.barangay},
      addr_city = ${addr.city},
      addr_province = ${addr.province},
      addr_postal_code = ${addr.postalCode},
      temporary_address = ${merged.temporaryAddress},
      position = ${merged.position},
      employment_status = ${merged.employmentStatus},
      date_hired = ${merged.dateHired},
      current_rate = ${merged.currentRate},
      emergency_contact = ${merged.emergencyContact},
      emergency_phone = ${merged.emergencyPhone},
      password = ${merged.password},
      contractor_id = ${merged.contractorId},
      payout_mode = ${merged.payoutMode},
      paypal_link = ${merged.paypalLink},
      ewallet_name = ${merged.ewalletName},
      ewallet_number = ${merged.ewalletNumber},
      bank_name = ${merged.bankName},
      bank_account_number = ${merged.bankAccountNumber},
      bank_account_name = ${merged.bankAccountName},
      weekly_report_link = ${merged.weeklyReportLink},
      profile_picture = ${merged.profilePicture},
      work_schedule = ${JSON.stringify(merged.workSchedule || DEFAULT_SCHEDULE)}
    WHERE id = ${id}
  `;
  if (admin) await approveVAEmail(id, merged.email);
  if (updates.password !== undefined) await invalidateVASessions(id);
}

export async function deleteProfile(id: string): Promise<void> {
  await requireAdminSession();
  await sql`DELETE FROM va_profiles WHERE id = ${id}`;
}

export async function resetPassword(id: string): Promise<void> {
  await requireAdminSession();
  await sql`UPDATE va_profiles SET password = 'gyva2026' WHERE id = ${id}`;
  await invalidateVASessions(id);
}

export async function authenticateVA(vaId: string, password: string) {
  await ensureTablesOnce();
  const { rows } = await sql`SELECT id FROM va_profiles WHERE id=${vaId} AND password=${password}`;
  if (!rows.length) return null;
  await createVASession(String(rows[0].id));
  return { id: String(rows[0].id) };
}
export async function getCurrentVASession() { return getVASession(); }
export async function logoutVA() { await clearVASession(); }
export async function changeVAPassword(vaId: string, currentPassword: string, newPassword: string) {
  await requireVAOrAdmin(vaId);
  if (newPassword.length < 6) return { success: false, error: "New password must be at least 6 characters." };
  const { rows } = await sql`UPDATE va_profiles SET password=${newPassword} WHERE id=${vaId} AND password=${currentPassword} RETURNING id`;
  if (!rows.length) return { success: false, error: "Current password is incorrect." };
  await invalidateVASessions(vaId);
  await createVASession(vaId);
  return { success: true };
}

// ── Salary Adjustments ──

function sortByEffectivityDate<T extends { effectivityDate: string }>(items: T[]): T[] {
  return items.sort((a, b) => {
    const da = new Date(a.effectivityDate).getTime() || 0;
    const db = new Date(b.effectivityDate).getTime() || 0;
    return db - da;
  });
}

export async function getAdjustmentsFor(vaId: string): Promise<(SalaryAdjustment & { id: number })[]> {
  const { rows } = await sql`SELECT * FROM salary_adjustments WHERE va_id = ${vaId} ORDER BY id`;
  return sortByEffectivityDate(rows.map(rowToAdjustment));
}

export async function getAllAdjustments(): Promise<Record<string, (SalaryAdjustment & { id: number })[]>> {
  const { rows } = await sql`SELECT * FROM salary_adjustments ORDER BY id`;
  const map: Record<string, (SalaryAdjustment & { id: number })[]> = {};
  for (const r of rows) {
    const vaId = r.va_id as string;
    if (!map[vaId]) map[vaId] = [];
    map[vaId].push(rowToAdjustment(r));
  }
  for (const vaId of Object.keys(map)) {
    sortByEffectivityDate(map[vaId]);
  }
  return map;
}

export async function addAdjustment(vaId: string, adj: SalaryAdjustment): Promise<void> {
  const admin = await requireAdminSession();
  await ensureTablesOnce();
  await recordSalaryAdjustment(vaId, adj, admin.username);
  wakeEmailDelivery();
}

export async function updateAdjustment(adjId: number, vaId: string, adj: SalaryAdjustment): Promise<void> {
  await requireAdminSession();
  await sql`
    UPDATE salary_adjustments
    SET va_id = ${vaId}, effectivity_date = ${adj.effectivityDate}, type = ${adj.type},
        hourly_rate = ${adj.hourlyRate}, sales_commission = ${adj.salesCommission},
        referral_bonus = ${adj.referralBonus}, notes = ${adj.notes}
    WHERE id = ${adjId}
  `;
}

export async function deleteAdjustment(adjId: number): Promise<void> {
  await requireAdminSession();
  await sql`DELETE FROM salary_adjustments WHERE id = ${adjId}`;
}

// ── Invoices ──

export async function getInvoicesFor(vaId: string): Promise<Invoice[]> {
  await requireVAOrAdmin(vaId);
  await ensureTablesOnce();
  const { rows } = await sql`SELECT * FROM invoices WHERE va_id = ${vaId} ORDER BY id`;
  return rows.map(rowToInvoice);
}

export async function getAllInvoicesFlat(): Promise<{ vaId: string; vaName: string; clientName: string; invoice: Invoice }[]> {
  await requireAdminSession();
  await ensureTablesOnce();
  const { rows } = await sql`
    SELECT i.*, p.first_name, p.last_name, c.display_name as client_name
    FROM invoices i
    JOIN va_profiles p ON i.va_id = p.id
    LEFT JOIN client_accounts c ON i.client_id = c.id
    WHERE i.invoice_number != '' AND i.amount != ''
    ORDER BY i.id
  `;
  return rows.map((r) => ({
    vaId: r.va_id as string,
    vaName: `${r.first_name} ${r.last_name}`,
    clientName: (r.client_name as string) || "",
    invoice: rowToInvoice(r),
  }));
}

export async function addInvoice(vaId: string, inv: Invoice, submissionKey?: string): Promise<void> {
  await requireVAOrAdmin(vaId);
  await ensureTablesOnce();
  await submitVAInvoice(vaId, inv, submissionKey);
  wakeEmailDelivery();
}

export async function updateInvoice(invoiceNumber: string, updates: Partial<Invoice>): Promise<void> {
  await ensureTablesOnce();
  const { rows } = await sql`SELECT va_id FROM invoices WHERE invoice_number=${invoiceNumber} LIMIT 2`;
  if (rows.length !== 1) throw new Error("Invoice not found or its number is duplicated. Contact an administrator.");
  const admin = await requireVAOrAdmin(String(rows[0].va_id));
  await saveVAInvoice(invoiceNumber, updates, admin);
  wakeEmailDelivery();
}

export async function updateInvoiceStatus(invoiceNumber: string, status: Invoice["status"]): Promise<void> {
  const admin = await requireAdminSession();
  await ensureTablesOnce();
  await saveVAInvoice(invoiceNumber, { status }, admin);
  wakeEmailDelivery();
}

export async function deleteInvoice(invoiceNumber: string): Promise<void> {
  await requireAdminSession();
  await sql`DELETE FROM invoices WHERE invoice_number = ${invoiceNumber}`;
}

export async function generateNextInvoiceNumber(vaId: string): Promise<string> {
  await requireVAOrAdmin(vaId);
  const { rows } = await sql`
    SELECT invoice_number FROM invoices WHERE va_id = ${vaId} ORDER BY id DESC LIMIT 1
  `;
  let next = 1;
  if (rows.length > 0) {
    const last = rows[0].invoice_number as string;
    const match = last.match(/-(\d+)$/);
    if (match) next = parseInt(match[1]) + 1;
  }
  return `${vaId}-${String(next).padStart(3, "0")}`;
}

// ── Leave Requests ──

export async function getRequestsFor(vaId: string): Promise<LeaveRequest[]> {
  await requireVAOrAdmin(vaId);
  await ensureTablesOnce();
  const { rows } = await sql`SELECT r.*,c.display_name AS client_name FROM leave_requests r LEFT JOIN client_accounts c ON c.id=r.client_id WHERE r.va_id = ${vaId} ORDER BY r.request_id`;
  return rows.map(rowToRequest);
}

export async function getAllRequestsFlat(): Promise<{ vaId: string; vaName: string; request: LeaveRequest }[]> {
  await requireAdminSession();
  await ensureTablesOnce();
  const { rows } = await sql`
    SELECT r.*, p.first_name, p.last_name,c.display_name AS client_name
    FROM leave_requests r
    JOIN va_profiles p ON r.va_id = p.id
    LEFT JOIN client_accounts c ON c.id=r.client_id
    ORDER BY r.request_id
  `;
  return rows.map((r) => ({
    vaId: r.va_id as string,
    vaName: `${r.first_name} ${r.last_name}`,
    request: rowToRequest(r),
  }));
}

export async function addRequest(vaId: string, req: LeaveRequest): Promise<void> {
  await requireVAOrAdmin(vaId);
  await ensureTablesOnce();
  await submitWorkflowRequest(vaId, req);
  wakeEmailDelivery();
}

export async function updateRequestStatus(id: string, status: LeaveRequest["status"], remarks?: string): Promise<void> {
  const admin = await requireAdminSession();
  await ensureTablesOnce();
  await setWorkflowRequestStatus(id, status, remarks, admin.username);
  wakeEmailDelivery();
}

export async function updateRequestDetails(
  id: string,
  updates: { type?: LeaveRequest["type"]; dateFrom?: string; dateTo?: string; reason?: string; clientId?: number }
): Promise<void> {
  await ensureTablesOnce();
  const { rows } = await sql`SELECT * FROM leave_requests WHERE request_id=${id}`;
  if (!rows.length) return;
  const admin = await requireVAOrAdmin(String(rows[0].va_id));
  if (updates.type !== undefined && !["Leave", "Shift Adjustment"].includes(updates.type)) throw new Error("Invalid request type.");
  const clientId = await selectedRequestClient(String(rows[0].va_id), updates.clientId ?? (rows[0].client_id == null ? undefined : Number(rows[0].client_id)));
  const previous = rows[0];
  if (Number(previous.client_id) === clientId && (updates.type ?? previous.type) === previous.type &&
    (updates.dateFrom ?? previous.date_from) === previous.date_from && (updates.dateTo ?? previous.date_to) === previous.date_to &&
    (updates.reason ?? previous.reason) === previous.reason) return;
  const changed = await sql`WITH changed AS (UPDATE leave_requests SET client_id=${clientId},type=COALESCE(${updates.type ?? null},type),
    date_from=COALESCE(${updates.dateFrom ?? null},date_from),date_to=COALESCE(${updates.dateTo ?? null},date_to),reason=COALESCE(${updates.reason ?? null},reason),
    requires_dual_approval=true,status='Pending',admin_approval='Pending',client_approval='Pending',
    admin_approval_at=NULL,client_approval_at=NULL,admin_approved_by='',client_approved_by='',admin_remarks='',client_remarks='',remarks=''
    WHERE request_id=${id} AND (${Boolean(admin)} OR (status='Pending' AND admin_approval='Pending' AND client_approval='Pending')) RETURNING *
  ), notices AS (
    INSERT INTO notifications(va_id,audience,client_id,title,message,type,created_by,created_at,redirect_to)
    SELECT '','client',r.client_id,r.type || ' request updated — approval needed',
      p.first_name || ' ' || p.last_name || E'\nThe request details changed. Please review and approve the updated request.' ||
      E'\nPeriod: ' || r.date_from || ' to ' || r.date_to || E'\nReason: ' || r.reason,
      'request','system',${new Date().toISOString()},'/client/dashboard/requests'
    FROM changed r JOIN va_profiles p ON p.id=r.va_id RETURNING id
  ) SELECT request_id FROM changed`;
  if (!changed.rows.length) throw new Error("Only pending requests can be edited. Refresh your request list.");
  wakeEmailDelivery();
}

export async function updateRequestRemarks(id: string, remarks: string): Promise<void> {
  await requireAdminSession();
  if (typeof remarks !== "string" || remarks.length > 5000) throw new Error("Enter remarks up to 5,000 characters.");
  await ensureTablesOnce();
  await sql`UPDATE leave_requests SET admin_remarks=${remarks},remarks=concat_ws(E'\n',NULLIF(${remarks},''),NULLIF(client_remarks,'')) WHERE request_id=${id}`;
}

export async function deleteRequest(id: string): Promise<void> {
  await requireAdminSession();
  await sql`DELETE FROM leave_requests WHERE request_id = ${id}`;
}

export async function generateNextRequestId(): Promise<string> {
  const { rows } = await sql`
    SELECT request_id FROM leave_requests ORDER BY request_id DESC LIMIT 1
  `;
  let next = 1;
  if (rows.length > 0) {
    const last = rows[0].request_id as string;
    const match = last.match(/-(\d+)$/);
    if (match) next = parseInt(match[1]) + 1;
  }
  return `LR-${String(next).padStart(3, "0")}`;
}

// ── Admin Accounts ──

export type AdminAccount = {
  id: number;
  username: string;
  displayName: string;
  createdAt: string;
};

export async function authenticateAdmin(username: string, password: string): Promise<AdminAccount | null> {
  await ensureTablesOnce();
  const { rows } = await sql`SELECT * FROM admin_accounts WHERE username = ${username} AND password = ${password}`;
  if (rows.length === 0) return null;
  const r = rows[0];
  await createAdminSession(r.id as number);
  return { id: r.id as number, username: r.username as string, displayName: r.display_name as string, createdAt: r.created_at as string };
}

export async function getCurrentAdminSession() {
  return getAdminSession();
}

export async function logoutAdmin(): Promise<void> {
  await clearAdminSession();
}

export async function getAdminAccounts(): Promise<AdminAccount[]> {
  await requireAdminSession();
  await ensureTablesOnce();
  const { rows } = await sql`SELECT id, username, display_name, created_at FROM admin_accounts ORDER BY id`;
  return rows.map((r) => ({ id: r.id as number, username: r.username as string, displayName: r.display_name as string, createdAt: r.created_at as string }));
}

export async function addAdminAccount(username: string, password: string, displayName: string): Promise<{ success: boolean; error?: string }> {
  await requireAdminSession();
  await ensureTablesOnce();
  if (!username.trim() || !displayName.trim() || password.length < 6) {
    return { success: false, error: "Username, display name, and a password of at least 6 characters are required." };
  }
  const { rows } = await sql`SELECT id FROM admin_accounts WHERE username = ${username}`;
  if (rows.length > 0) return { success: false, error: "Username already exists" };
  const now = estDateLong();
  await sql`INSERT INTO admin_accounts (username, password, display_name, created_at) VALUES (${username}, ${password}, ${displayName}, ${now})`;
  return { success: true };
}

export async function changeAdminPassword(username: string, currentPassword: string, newPassword: string): Promise<{ success: boolean; error?: string }> {
  const session = await requireAdminSession();
  if (session.username !== username) return { success: false, error: "You can only change your own password." };
  if (newPassword.length < 6) return { success: false, error: "Password must be at least 6 characters." };
  await ensureTablesOnce();
  const { rows } = await sql`SELECT id FROM admin_accounts WHERE username = ${username} AND password = ${currentPassword}`;
  if (rows.length === 0) return { success: false, error: "Current password is incorrect" };
  await sql`UPDATE admin_accounts SET password = ${newPassword} WHERE username = ${username}`;
  await invalidateAdminSessions(session.id);
  await createAdminSession(session.id);
  return { success: true };
}

export async function deleteAdminAccount(id: number): Promise<{ success: boolean; error?: string }> {
  await requireAdminSession();
  await ensureTablesOnce();
  const { rows } = await sql`SELECT COUNT(*) as cnt FROM admin_accounts`;
  const count = parseInt(rows[0].cnt as string) || 0;
  if (count <= 1) return { success: false, error: "Cannot delete the last admin account" };
  await sql`DELETE FROM admin_accounts WHERE id = ${id}`;
  return { success: true };
}

export async function resetAdminPassword(id: number): Promise<void> {
  const session = await requireAdminSession();
  await ensureTablesOnce();
  await sql`UPDATE admin_accounts SET password = 'gyadmin2026' WHERE id = ${id}`;
  await invalidateAdminSessions(id);
  if (session.id === id) await clearAdminSession();
}

// ── Client Accounts ──

export type ClientAccount = {
  id: number;
  email: string;
  displayName: string;
  companyName: string;
  address: string;
  phone: string;
  timesheetUrl: string;
  timesheetViewUrl: string;
  createdAt: string;
  invoiceLayout?: InvoiceLayout;
};

function rowToClientAccount(r: Record<string, unknown>): ClientAccount {
  return {
    id: r.id as number,
    email: r.email as string,
    displayName: r.display_name as string,
    companyName: (r.company_name as string) || "",
    address: (r.address as string) || "",
    phone: (r.phone as string) || "",
    timesheetUrl: (r.timesheet_url as string) || "",
    timesheetViewUrl: (r.timesheet_view_url as string) || "",
    createdAt: r.created_at as string,
    invoiceLayout: r.invoice_layout === "legacy" ? "legacy" : "itemized",
  };
}

export async function authenticateClient(email: string, password: string): Promise<ClientAccount | null> {
  await ensureTablesOnce();
  const { rows } = await sql`SELECT * FROM client_accounts WHERE email = ${email} AND password = ${password}`;
  if (rows.length === 0) return null;
  await createClientSession(Number(rows[0].id));
  return rowToClientAccount(rows[0]);
}

export async function getCurrentClient() { return getClientSession(); }
export async function logoutClient() { await clearClientSession(); }

export async function getClientAccounts(): Promise<ClientAccount[]> {
  await ensureTablesOnce();
  const { rows } = await sql`SELECT * FROM client_accounts ORDER BY id`;
  return rows.map(rowToClientAccount);
}

export async function getClientAccountByEmail(email: string): Promise<ClientAccount | null> {
  await ensureTablesOnce();
  const { rows } = await sql`SELECT * FROM client_accounts WHERE email = ${email}`;
  if (rows.length === 0) return null;
  return rowToClientAccount(rows[0]);
}

export async function addClientAccount(email: string, password: string, displayName: string, companyName?: string, address?: string, phone?: string): Promise<{ success: boolean; error?: string }> {
  await requireAdminSession();
  await ensureTablesOnce();
  const { rows } = await sql`SELECT id FROM client_accounts WHERE email = ${email}`;
  if (rows.length > 0) return { success: false, error: "Email already exists" };
  const now = estDateLong();
  await sql`INSERT INTO client_accounts (email, password, display_name, company_name, address, phone, created_at) VALUES (${email}, ${password}, ${displayName}, ${companyName || ""}, ${address || ""}, ${phone || ""}, ${now})`;
  return { success: true };
}

export async function updateClientAccount(id: number, updates: { displayName?: string; companyName?: string; address?: string; phone?: string; email?: string; timesheetUrl?: string; timesheetViewUrl?: string }): Promise<void> {
  await requireAdminSession();
  await ensureTablesOnce();
  const { rows } = await sql`SELECT * FROM client_accounts WHERE id = ${id}`;
  if (rows.length === 0) return;
  const current = rowToClientAccount(rows[0]);
  await sql`
    UPDATE client_accounts SET
      display_name = ${updates.displayName ?? current.displayName},
      company_name = ${updates.companyName ?? current.companyName},
      address = ${updates.address ?? current.address},
      phone = ${updates.phone ?? current.phone},
      email = ${updates.email ?? current.email},
      timesheet_url = ${updates.timesheetUrl ?? current.timesheetUrl},
      timesheet_view_url = ${updates.timesheetViewUrl ?? current.timesheetViewUrl}
    WHERE id = ${id}
  `;
}

export async function updateClientAccountByEmail(email: string, updates: { displayName?: string; companyName?: string; address?: string; phone?: string }): Promise<void> {
  await ensureTablesOnce();
  const { rows } = await sql`SELECT * FROM client_accounts WHERE email = ${email}`;
  if (rows.length === 0) return;
  const current = rowToClientAccount(rows[0]);
  await sql`
    UPDATE client_accounts SET
      display_name = ${updates.displayName ?? current.displayName},
      company_name = ${updates.companyName ?? current.companyName},
      address = ${updates.address ?? current.address},
      phone = ${updates.phone ?? current.phone}
    WHERE email = ${email}
  `;
}

export async function deleteClientAccount(id: number): Promise<void> {
  await sql`DELETE FROM client_accounts WHERE id = ${id}`;
}

export async function resetClientPassword(id: number): Promise<void> {
  await requireAdminSession();
  await invalidateClientSessions(id);
  await sql`UPDATE client_accounts SET password = 'gyclient2026' WHERE id = ${id}`;
}

export async function changeClientPassword(email: string, currentPassword: string, newPassword: string): Promise<{ success: boolean; error?: string }> {
  await ensureTablesOnce();
  const { rows } = await sql`SELECT id FROM client_accounts WHERE email = ${email} AND password = ${currentPassword}`;
  if (rows.length === 0) return { success: false, error: "Current password is incorrect" };
  await sql`UPDATE client_accounts SET password = ${newPassword} WHERE email = ${email}`;
  await invalidateClientSessions(Number(rows[0].id));
  await createClientSession(Number(rows[0].id));
  return { success: true };
}

// ── Client Invoices ──

export type ClientInvoice = {
  id: number;
  clientId: number;
  invoiceNumber: string;
  billCoverage: string;
  amount: string;
  invoiceDueDate: string;
  status: string;
  invoiceLink: string;
  invoiceLayout?: InvoiceLayout;
  lineItems?: InvoiceLineItem[];
  paymentLink?: string;
  billToName?: string;
  billToCompany?: string;
  additionalRecipients?: string;
  emailStatus?: EmailJobStatus | null;
  emailError?: string | null;
};

function rowToClientInvoice(r: Record<string, unknown>): ClientInvoice {
  return {
    id: r.id as number,
    clientId: r.client_id as number,
    invoiceNumber: r.invoice_number as string,
    billCoverage: r.bill_coverage as string,
    amount: r.amount as string,
    invoiceDueDate: r.invoice_due_date as string,
    status: r.status as string,
    invoiceLink: r.invoice_link as string,
    invoiceLayout: r.invoice_layout === "itemized" ? "itemized" : "legacy",
    lineItems: Array.isArray(r.line_items) ? r.line_items as InvoiceLineItem[] : [],
    paymentLink: String(r.payment_link || ""),
    billToName: String(r.bill_to_name || ""),
    billToCompany: String(r.bill_to_company || ""),
    additionalRecipients: String(r.additional_recipients || ""),
    emailStatus: r.email_status as EmailJobStatus | null | undefined,
    emailError: r.email_error == null ? null : String(r.email_error),
  };
}

export async function getClientInvoices(): Promise<ClientInvoice[]> {
  await requireAdminSession();
  await ensureTablesOnce();
  const { rows } = await sql`SELECT i.*,j.status AS email_status,j.last_error AS email_error
    FROM client_invoices i LEFT JOIN LATERAL (
      SELECT status,last_error FROM email_jobs WHERE (source='invoice' AND source_id=i.id) OR client_invoice_id=i.id
      ORDER BY (status IN ('queued','sending')) DESC,id DESC LIMIT 1
    ) j ON true
    ORDER BY i.id DESC`;
  return rows.map(rowToClientInvoice);
}

export async function getClientInvoicesByClientId(clientId: number, excludeDraft = false): Promise<ClientInvoice[]> {
  const admin = await getAdminSession();
  if (!admin && (await requireClientSession()).id !== clientId) throw new Error("You can only view your own invoices.");
  await ensureTablesOnce();
  const { rows } = await sql`SELECT * FROM client_invoices WHERE client_id = ${clientId} ORDER BY id DESC`;
  const all = rows.map(rowToClientInvoice);
  if (excludeDraft || !admin) return all.filter((inv) => inv.status.trim().toLowerCase() !== "draft");
  return all;
}

export async function getClientInvoicesByEmail(email: string): Promise<ClientInvoice[]> {
  if (!await getAdminSession()) {
    const client = await requireClientSession();
    if (client.email.toLowerCase() !== email.trim().toLowerCase()) throw new Error("You can only view your own invoices.");
  }
  await ensureTablesOnce();
  const { rows: acctRows } = await sql`SELECT id FROM client_accounts WHERE email = ${email}`;
  if (acctRows.length === 0) return [];
  const clientId = acctRows[0].id as number;
  return getClientInvoicesByClientId(clientId, true);
}

export async function addClientInvoice(inv: Omit<ClientInvoice, "id">): Promise<void> {
  await requireAdminSession();
  await ensureTablesOnce();
  const recipients = parseEmailAddresses(inv.additionalRecipients ?? "", 10).join(", ");
  const { rows: accounts } = await sql`SELECT id,invoice_layout,display_name,company_name FROM client_accounts WHERE id=${inv.clientId}`;
  if (!accounts.length) throw new Error("Select an existing client.");
  const account = accounts[0];
  const layout = account.invoice_layout === 'legacy' ? 'legacy' : 'itemized';
  const itemized = layout === 'itemized' ? invoiceItems(inv.lineItems) : null;
  if (itemized) validateItemizedInvoiceDetails(inv);
  const amount = itemized?.amount ?? inv.amount;
  const paymentLink = itemized ? invoicePaymentLink(inv.paymentLink ?? DEFAULT_INVOICE_PAYMENT_LINK) : '';
  await sql`
    WITH published AS (
    INSERT INTO client_invoices (client_id, invoice_number, bill_coverage, amount, invoice_due_date, status, invoice_link, additional_recipients,
      invoice_layout,line_items,payment_link,bill_to_name,bill_to_company,email_published_at,portal_notified_at)
    VALUES (${inv.clientId}, ${inv.invoiceNumber}, ${inv.billCoverage}, ${amount}, ${inv.invoiceDueDate}, ${inv.status}, ${inv.invoiceLink},${recipients},
      ${layout},${JSON.stringify(itemized?.items || [])}::jsonb,${paymentLink},${itemized ? String(account.display_name || '') : ''},${itemized ? String(account.company_name || '') : ''},
      CASE WHEN LOWER(TRIM(${inv.status})) != 'draft' THEN NOW() ELSE NULL END,
      CASE WHEN LOWER(TRIM(${inv.status})) != 'draft' THEN NOW() ELSE NULL END) RETURNING *
    ) INSERT INTO notifications(audience,client_id,title,message,type,created_by,created_at,redirect_to,client_invoice_id)
      SELECT 'client',client_id,CASE WHEN LOWER(TRIM(status))='paid' THEN 'Client Invoice - Paid' ELSE 'New invoice available' END,
        CASE WHEN LOWER(TRIM(status))='paid' THEN 'Your invoice ' || invoice_number || ' has been marked as paid. Thank you for your payment.'
          ELSE 'Your invoice ' || invoice_number || ' is now available.' END ||
        E'\nBilling period: ' || bill_coverage || CASE WHEN LOWER(TRIM(status))='paid' THEN E'\nInvoice amount: ' || amount
          ELSE E'\nTotal amount due: ' || amount || E'\nPayment due date: ' || invoice_due_date END,
        CASE WHEN LOWER(TRIM(status))='paid' THEN 'payment' ELSE 'invoice' END,
        'system',${new Date().toISOString()},'/client/dashboard/invoices',id FROM published WHERE portal_notified_at IS NOT NULL
  `;
  wakeEmailDelivery();
}

export async function updateClientInvoice(id: number, inv: Omit<ClientInvoice, "id">): Promise<void> {
  await requireAdminSession();
  await ensureTablesOnce();
  const recipients = inv.additionalRecipients === undefined ? null : parseEmailAddresses(inv.additionalRecipients, 10).join(", ");
  const { rows: previousRows } = await sql`SELECT i.*,c.invoice_layout AS account_layout FROM client_invoices i
    JOIN client_accounts c ON c.id=${inv.clientId} WHERE i.id=${id}`;
  if (!previousRows.length) throw new Error("Invoice or client not found.");
  const original = previousRows[0];
  const isItemized = original.invoice_layout === 'itemized';
  if (isItemized && Number(original.client_id) !== inv.clientId) throw new Error("An itemized invoice cannot be reassigned. Create a separate invoice for the other client.");
  if (isItemized && original.account_layout === 'legacy') throw new Error("This client uses the original invoice format.");
  const itemized = isItemized ? invoiceItems(inv.lineItems ?? original.line_items) : null;
  if (itemized) validateItemizedInvoiceDetails(inv);
  const amount = itemized?.amount ?? inv.amount;
  const paymentLink = itemized ? invoicePaymentLink(inv.paymentLink ?? String(original.payment_link || '')) : '';
  await sql`
    WITH previous AS MATERIALIZED (SELECT * FROM client_invoices WHERE id=${id} FOR UPDATE), changed AS (
    UPDATE client_invoices i SET
      client_id = ${inv.clientId},
      invoice_number = ${inv.invoiceNumber},
      bill_coverage = ${inv.billCoverage},
      amount = ${amount},
      line_items = ${JSON.stringify(itemized?.items || [])}::jsonb,
      payment_link = ${paymentLink},
      invoice_due_date = ${inv.invoiceDueDate},
      status = ${inv.status},
      invoice_link = ${inv.invoiceLink},
      additional_recipients = CASE WHEN previous.client_id!=${inv.clientId} THEN COALESCE(${recipients},'')
        ELSE COALESCE(${recipients},previous.additional_recipients) END,
      email_published_at = CASE WHEN LOWER(TRIM(previous.status)) = 'draft' AND LOWER(TRIM(${inv.status})) != 'draft'
        THEN COALESCE(previous.email_published_at,NOW()) ELSE previous.email_published_at END,
      portal_notified_at = CASE WHEN LOWER(TRIM(previous.status)) = 'draft' AND LOWER(TRIM(${inv.status})) != 'draft'
        THEN COALESCE(previous.portal_notified_at,NOW()) ELSE previous.portal_notified_at END
    FROM previous WHERE i.id=previous.id
    RETURNING i.*
    ) INSERT INTO notifications(audience,client_id,title,message,type,created_by,created_at,redirect_to,client_invoice_id)
      SELECT 'client',c.client_id,'New invoice available','Your invoice ' || c.invoice_number || ' is now available.' ||
        E'\nBilling period: ' || c.bill_coverage || E'\nTotal amount due: ' || c.amount || E'\nPayment due date: ' || c.invoice_due_date,
        'invoice','system',${new Date().toISOString()},'/client/dashboard/invoices',c.id
      FROM changed c JOIN previous p ON p.id=c.id
      WHERE LOWER(TRIM(p.status))='draft' AND LOWER(TRIM(c.status)) NOT IN ('draft','paid') AND p.portal_notified_at IS NULL
      UNION ALL
      SELECT 'client',c.client_id,'Client Invoice - Paid','Your invoice ' || c.invoice_number ||
        ' has been marked as paid. Thank you for your payment.' || E'\nBilling period: ' || c.bill_coverage ||
        E'\nInvoice amount: ' || c.amount,
        'payment','system',${new Date().toISOString()},'/client/dashboard/invoices',c.id
      FROM changed c JOIN previous p ON p.id=c.id
      WHERE LOWER(TRIM(c.status))='paid' AND LOWER(TRIM(p.status))!='paid'
  `;
  wakeEmailDelivery();
}

export async function deleteClientInvoice(id: number): Promise<void> {
  await requireAdminSession();
  await sql`DELETE FROM client_invoices WHERE id = ${id}`;
}

// ── VA-Client Assignments ──

export async function getVAClientAssignments(): Promise<{ vaId: string; clientId: number; clientRate: string; reportUrl: string; reportViewUrl: string }[]> {
  await ensureTablesOnce();
  const { rows } = await sql`SELECT va_id, client_id, client_rate, report_url, report_view_url FROM va_client_assignments`;
  return rows.map((r) => ({ vaId: r.va_id as string, clientId: r.client_id as number, clientRate: (r.client_rate as string) || "", reportUrl: (r.report_url as string) || "", reportViewUrl: (r.report_view_url as string) || "" }));
}

export async function getClientIdsForVA(vaId: string): Promise<number[]> {
  await ensureTablesOnce();
  const { rows } = await sql`SELECT client_id FROM va_client_assignments WHERE va_id = ${vaId}`;
  return rows.map((r) => r.client_id as number);
}

export async function getClientsForVA(vaId: string): Promise<ClientAccount[]> {
  await ensureTablesOnce();
  const { rows } = await sql`
    SELECT ca.* FROM client_accounts ca
    JOIN va_client_assignments vca ON vca.client_id = ca.id
    WHERE vca.va_id = ${vaId}
    ORDER BY ca.display_name
  `;
  return rows.map(rowToClientAccount);
}

export async function setVAClientAssignments(vaId: string, assignments: { clientId: number; clientRate: string; reportUrl?: string; reportViewUrl?: string }[]): Promise<void> {
  await ensureTablesOnce();
  await sql`DELETE FROM va_client_assignments WHERE va_id = ${vaId}`;
  for (const a of assignments) {
    await sql`INSERT INTO va_client_assignments (va_id, client_id, client_rate, report_url, report_view_url) VALUES (${vaId}, ${a.clientId}, ${a.clientRate}, ${a.reportUrl || ""}, ${a.reportViewUrl || ""}) ON CONFLICT DO NOTHING`;
  }
}

export async function getAssignmentsForVA(vaId: string): Promise<{ clientId: number; clientName: string; clientRate: string; reportUrl: string; reportViewUrl: string }[]> {
  await ensureTablesOnce();
  const { rows } = await sql`
    SELECT vca.client_id, ca.display_name, vca.client_rate, vca.report_url, vca.report_view_url
    FROM va_client_assignments vca
    JOIN client_accounts ca ON ca.id = vca.client_id
    WHERE vca.va_id = ${vaId}
    ORDER BY ca.display_name
  `;
  return rows.map((r) => ({
    clientId: r.client_id as number,
    clientName: (r.display_name as string) || "",
    clientRate: (r.client_rate as string) || "",
    reportUrl: (r.report_url as string) || "",
    reportViewUrl: (r.report_view_url as string) || "",
  }));
}

export async function getAssignmentsByClientEmail(email: string): Promise<{ vaId: string; vaName: string; reportUrl: string; reportViewUrl: string }[]> {
  await ensureTablesOnce();
  const { rows } = await sql`
    SELECT vca.va_id, vp.first_name, vp.last_name, vca.report_url, vca.report_view_url
    FROM va_client_assignments vca
    JOIN va_profiles vp ON vp.id = vca.va_id
    JOIN client_accounts ca ON ca.id = vca.client_id
    WHERE ca.email = ${email}
    ORDER BY vp.first_name
  `;
  return rows.map((r) => ({
    vaId: r.va_id as string,
    vaName: `${r.first_name} ${r.last_name}`,
    reportUrl: (r.report_url as string) || "",
    reportViewUrl: (r.report_view_url as string) || "",
  }));
}

export async function getVAsByClientEmail(email: string): Promise<(VAProfile & { clientRate: string })[]> {
  await ensureTablesOnce();
  const { rows } = await sql`
    SELECT vp.*, vca.client_rate FROM va_profiles vp
    JOIN va_client_assignments vca ON vca.va_id = vp.id
    JOIN client_accounts ca ON ca.id = vca.client_id
    WHERE ca.email = ${email}
    ORDER BY vp.first_name
  `;
  return rows.map((r) => ({ ...rowToProfile(r), clientRate: (r.client_rate as string) || "" }));
}

// ── Client Salary Adjustments ──

export type ClientSalaryAdjustment = {
  id: number;
  clientId: number;
  vaId: string;
  effectivityDate: string;
  type: string;
  hourlyRate: string;
  salesCommission: string;
  referralBonus: string;
  notes: string;
};

function rowToClientSalaryAdjustment(r: Record<string, unknown>): ClientSalaryAdjustment {
  return {
    id: r.id as number,
    clientId: r.client_id as number,
    vaId: r.va_id as string,
    effectivityDate: r.effectivity_date as string,
    type: r.type as string,
    hourlyRate: r.hourly_rate as string,
    salesCommission: r.sales_commission as string,
    referralBonus: r.referral_bonus as string,
    notes: r.notes as string,
  };
}

export async function getClientSalaryAdjustments(): Promise<ClientSalaryAdjustment[]> {
  await ensureTablesOnce();
  const { rows } = await sql`SELECT * FROM client_salary_adjustments ORDER BY id DESC`;
  return sortByEffectivityDate(rows.map(rowToClientSalaryAdjustment));
}

export async function getClientSalaryAdjustmentsByClientId(clientId: number): Promise<ClientSalaryAdjustment[]> {
  await ensureTablesOnce();
  const { rows } = await sql`SELECT * FROM client_salary_adjustments WHERE client_id = ${clientId} ORDER BY id DESC`;
  return sortByEffectivityDate(rows.map(rowToClientSalaryAdjustment));
}

export async function getClientSalaryAdjustmentsByEmail(email: string): Promise<ClientSalaryAdjustment[]> {
  await ensureTablesOnce();
  const { rows } = await sql`
    SELECT csa.* FROM client_salary_adjustments csa
    JOIN client_accounts ca ON ca.id = csa.client_id
    WHERE ca.email = ${email}
    ORDER BY csa.id DESC
  `;
  return sortByEffectivityDate(rows.map(rowToClientSalaryAdjustment));
}

export async function addClientSalaryAdjustment(adj: Omit<ClientSalaryAdjustment, "id">): Promise<void> {
  await ensureTablesOnce();
  await sql`
    INSERT INTO client_salary_adjustments (client_id, va_id, effectivity_date, type, hourly_rate, sales_commission, referral_bonus, notes)
    VALUES (${adj.clientId}, ${adj.vaId}, ${adj.effectivityDate}, ${adj.type}, ${adj.hourlyRate}, ${adj.salesCommission}, ${adj.referralBonus}, ${adj.notes})
  `;
}

export async function updateClientSalaryAdjustment(id: number, adj: Omit<ClientSalaryAdjustment, "id">): Promise<void> {
  await ensureTablesOnce();
  await sql`
    UPDATE client_salary_adjustments
    SET client_id = ${adj.clientId}, va_id = ${adj.vaId}, effectivity_date = ${adj.effectivityDate},
        type = ${adj.type}, hourly_rate = ${adj.hourlyRate}, sales_commission = ${adj.salesCommission},
        referral_bonus = ${adj.referralBonus}, notes = ${adj.notes}
    WHERE id = ${id}
  `;
}

export async function deleteClientSalaryAdjustment(id: number): Promise<void> {
  await sql`DELETE FROM client_salary_adjustments WHERE id = ${id}`;
}

// ── Timeproof Entries ──

export type TimeproofEntry = ApprovalDetails & {
  id: number;
  vaId: string;
  clientId: number;
  punchDate: string;
  timeIn: string;
  timeOut: string;
  notes: string;
  createdAt: string;
  entryType: string;
  status: string;
};

function rowToTimeproofEntry(r: Record<string, unknown>): TimeproofEntry {
  return {
    ...approvalDetails(r),
    id: r.id as number,
    vaId: r.va_id as string,
    clientId: r.client_id as number,
    punchDate: r.punch_date as string,
    timeIn: r.time_in as string,
    timeOut: r.time_out as string,
    notes: (r.notes as string) || "",
    createdAt: (r.created_at as string) || "",
    entryType: (r.entry_type as string) || "time",
    status: (r.status as string) || "approved",
  };
}

export async function getTimeproofEntriesForVA(vaId: string): Promise<TimeproofEntry[]> {
  await requireVAOrAdmin(vaId);
  await ensureTablesOnce();
  const { rows } = await sql`SELECT * FROM timeproof_entries WHERE va_id = ${vaId} ORDER BY punch_date DESC, time_in DESC`;
  return rows.map(rowToTimeproofEntry);
}

export async function getTimeproofEntriesForVAClient(vaId: string, clientId: number): Promise<TimeproofEntry[]> {
  await requireVAOrAdmin(vaId);
  await ensureTablesOnce();
  const { rows } = await sql`SELECT * FROM timeproof_entries WHERE va_id = ${vaId} AND client_id = ${clientId} ORDER BY punch_date DESC, time_in DESC`;
  return rows.map(rowToTimeproofEntry);
}

export async function getTimeproofEntriesByClientEmail(email: string): Promise<(TimeproofEntry & { vaName: string })[]> {
  const client = await requireClientSession();
  if (client.email.toLowerCase() !== email.toLowerCase()) throw new Error("Client account does not match your session.");
  await ensureTablesOnce();
  const { rows } = await sql`
    SELECT te.*, vp.first_name, vp.last_name
    FROM timeproof_entries te
    JOIN va_profiles vp ON vp.id = te.va_id
    JOIN client_accounts ca ON ca.id = te.client_id
    WHERE ca.email = ${email}
    ORDER BY te.punch_date DESC, te.time_in DESC
  `;
  return rows.map((r) => ({ ...rowToTimeproofEntry(r), vaName: `${r.first_name} ${r.last_name}` }));
}

export async function getAllTimeproofEntries(): Promise<(TimeproofEntry & { vaName: string; clientName: string })[]> {
  await requireAdminSession();
  await ensureTablesOnce();
  const { rows } = await sql`
    SELECT te.*, vp.first_name, vp.last_name, ca.display_name as client_name
    FROM timeproof_entries te
    JOIN va_profiles vp ON vp.id = te.va_id
    JOIN client_accounts ca ON ca.id = te.client_id
    ORDER BY te.punch_date DESC, te.time_in DESC
  `;
  return rows.map((r) => ({ ...rowToTimeproofEntry(r), vaName: `${r.first_name} ${r.last_name}`, clientName: (r.client_name as string) || "" }));
}

function roundTime30(t: string): string {
  if (!t) return t;
  const [h, m] = t.split(":").map(Number);
  const total = Math.round((h * 60 + m) / 30) * 30;
  const rh = Math.floor(total / 60) % 24;
  const rm = total % 60;
  return `${String(rh).padStart(2, "0")}:${String(rm).padStart(2, "0")}`;
}

export async function addTimeproofEntry(entry: Omit<TimeproofEntry, "id"> & { submissionKey?: string }): Promise<void> {
  await ensureTablesOnce();
  const timeIn = roundTime30(entry.timeIn);
  const timeOut = roundTime30(entry.timeOut);
  if (entry.entryType === "overtime") {
    const admin = await requireVAOrAdmin(entry.vaId);
    if (!admin && entry.status !== "pending") throw new Error("Overtime requests must be submitted for approval.");
    await selectedRequestClient(entry.vaId, entry.clientId);
    await submitOvertime({ ...entry, timeIn, timeOut, adminName: admin?.username });
    wakeEmailDelivery();
    return;
  }
  await sql`
    INSERT INTO timeproof_entries (va_id, client_id, punch_date, time_in, time_out, notes, created_at, entry_type, status)
    VALUES (${entry.vaId}, ${entry.clientId}, ${entry.punchDate}, ${timeIn}, ${timeOut}, ${entry.notes}, ${entry.createdAt}, ${entry.entryType || "time"}, ${entry.status || "approved"})
  `;
}

export async function addBulkTimeproofEntries(entries: Omit<TimeproofEntry, "id">[]): Promise<void> {
  await ensureTablesOnce();
  for (const entry of entries) {
    await addTimeproofEntry(entry);
  }
}

export async function updateTimeproofEntry(id: number, updates: { timeIn?: string; timeOut?: string; notes?: string; punchDate?: string; entryType?: string }): Promise<void> {
  await ensureTablesOnce();
  const { rows } = await sql`SELECT * FROM timeproof_entries WHERE id=${id}`;
  if (!rows.length) return;
  const current = rowToTimeproofEntry(rows[0]);
  const admin = await requireVAOrAdmin(current.vaId);
  const affectsOvertime = current.entryType === "overtime" || updates.entryType === "overtime";
  if (affectsOvertime && !admin && (current.status !== "pending" || current.entryType !== "overtime" ||
    current.adminApproval !== "Pending" || current.clientApproval !== "Pending" ||
    (updates.entryType !== undefined && updates.entryType !== current.entryType))) {
    throw new Error("Reviewed overtime can only be changed by an administrator. Use Request Overtime for new overtime.");
  }
  if (affectsOvertime) await selectedRequestClient(current.vaId,current.clientId);
  const timeIn = roundTime30(updates.timeIn ?? current.timeIn), timeOut = roundTime30(updates.timeOut ?? current.timeOut);
  if (timeIn === current.timeIn && timeOut === current.timeOut && (updates.notes ?? current.notes) === current.notes &&
    (updates.punchDate ?? current.punchDate) === current.punchDate && (updates.entryType ?? current.entryType) === current.entryType) return;
  const changed = await sql`WITH changed AS (
    UPDATE timeproof_entries SET punch_date=${updates.punchDate ?? current.punchDate},time_in=${timeIn},time_out=${timeOut},
      notes=${updates.notes ?? current.notes},entry_type=${updates.entryType ?? current.entryType},
      status=CASE WHEN ${affectsOvertime} THEN 'pending' ELSE status END,
      requires_dual_approval=CASE WHEN ${affectsOvertime} THEN true ELSE requires_dual_approval END,
      admin_approval=CASE WHEN ${affectsOvertime} THEN 'Pending' ELSE admin_approval END,
      client_approval=CASE WHEN ${affectsOvertime} THEN 'Pending' ELSE client_approval END,
      admin_approval_at=NULL,client_approval_at=NULL,admin_approved_by='',client_approved_by='',admin_remarks='',client_remarks=''
    WHERE id=${id} AND (${Boolean(admin)} OR entry_type!='overtime' OR (status='pending' AND admin_approval='Pending' AND client_approval='Pending')) RETURNING *
  ), notices AS (
    INSERT INTO notifications(va_id,audience,client_id,title,message,type,created_by,created_at,redirect_to)
    SELECT '','client',r.client_id,'Overtime request updated — approval needed',
      p.first_name || ' ' || p.last_name || E'\nThe overtime details changed. Please review and approve the updated request.' ||
      E'\nDate: ' || r.punch_date || E'\nTime: ' || r.time_in || ' to ' || r.time_out,
      'request','system',${new Date().toISOString()},'/client/dashboard/requests?type=overtime'
    FROM changed r JOIN va_profiles p ON p.id=r.va_id WHERE r.entry_type='overtime' RETURNING id
  ) SELECT id FROM changed`;
  if (!changed.rows.length) throw new Error("This request was reviewed. Refresh before making changes.");
  if (affectsOvertime) wakeEmailDelivery();
}

export async function roundExistingTimeproofEntries(): Promise<number> {
  await ensureTablesOnce();
  const { rows } = await sql`SELECT id, time_in, time_out FROM timeproof_entries WHERE time_in != '' OR time_out != ''`;
  let updated = 0;
  for (const r of rows) {
    const oldIn = (r.time_in as string) || "";
    const oldOut = (r.time_out as string) || "";
    const newIn = roundTime30(oldIn);
    const newOut = roundTime30(oldOut);
    if (newIn !== oldIn || newOut !== oldOut) {
      await sql`UPDATE timeproof_entries SET time_in = ${newIn}, time_out = ${newOut} WHERE id = ${r.id}`;
      updated++;
    }
  }
  return updated;
}

export async function deleteTimeproofEntry(id: number): Promise<void> {
  await ensureTablesOnce();
  const { rows } = await sql`SELECT va_id FROM timeproof_entries WHERE id=${id}`;
  if (!rows.length) return;
  const admin = await requireVAOrAdmin(String(rows[0].va_id));
  const deleted = await sql`DELETE FROM timeproof_entries WHERE id=${id} AND
    (${Boolean(admin)} OR entry_type!='overtime' OR (status='pending' AND admin_approval='Pending' AND client_approval='Pending')) RETURNING id`;
  if (!deleted.rows.length) throw new Error("Reviewed overtime can only be deleted by an administrator.");
}

export async function updateTimeproofEntryStatus(id: number, status: string): Promise<void> {
  const admin = await requireAdminSession();
  await ensureTablesOnce();
  await setOvertimeStatus(id, status, admin.username);
  wakeEmailDelivery();
}

export async function getPendingOvertimeRequests(): Promise<(TimeproofEntry & { vaName: string; clientName: string })[]> {
  await requireAdminSession();
  await ensureTablesOnce();
  const { rows } = await sql`
    SELECT te.*, vp.first_name, vp.last_name, ca.display_name as client_name
    FROM timeproof_entries te
    JOIN va_profiles vp ON vp.id = te.va_id
    JOIN client_accounts ca ON ca.id = te.client_id
    WHERE te.entry_type = 'overtime' AND te.status = 'pending'
    ORDER BY te.created_at DESC
  `;
  return rows.map((r) => ({ ...rowToTimeproofEntry(r), vaName: `${r.first_name} ${r.last_name}`, clientName: (r.client_name as string) || "" }));
}

export async function getActiveVAIdsByClientEmail(email: string): Promise<string[]> {
  await ensureTablesOnce();
  const today = estDate();
  const { rows } = await sql`
    SELECT DISTINCT te.va_id
    FROM timeproof_entries te
    JOIN client_accounts ca ON ca.id = te.client_id
    WHERE ca.email = ${email}
      AND te.punch_date = ${today}
      AND te.time_in != ''
      AND (te.time_out IS NULL OR te.time_out = '')
  `;
  return rows.map((r) => r.va_id as string);
}

export async function isVACurrentlyWorking(vaId: string): Promise<boolean> {
  await ensureTablesOnce();
  const today = estDate();
  const { rows } = await sql`
    SELECT 1 FROM timeproof_entries
    WHERE va_id = ${vaId}
      AND punch_date = ${today}
      AND time_in != ''
      AND (time_out IS NULL OR time_out = '')
    LIMIT 1
  `;
  return rows.length > 0;
}

// ── Calendar Events ──

export type CalendarEvent = {
  id?: number;
  date: string;
  title: string;
  type: "holiday" | "birthday" | "anniversary" | "event" | "leave";
  vaId?: string;
};

const HOLIDAYS: { month: number; day: number; title: string }[] = [
  { month: 1, day: 1, title: "New Year's Day" },
  { month: 2, day: 14, title: "Valentine's Day" },
  { month: 2, day: 25, title: "EDSA People Power Anniversary" },
  { month: 4, day: 9, title: "Araw ng Kagitingan (Day of Valor)" },
  { month: 5, day: 1, title: "Labor Day (PH)" },
  { month: 6, day: 12, title: "Independence Day (PH)" },
  { month: 6, day: 19, title: "Juneteenth (US)" },
  { month: 7, day: 4, title: "Independence Day (US)" },
  { month: 8, day: 21, title: "Ninoy Aquino Day" },
  { month: 8, day: 26, title: "National Heroes Day" },
  { month: 11, day: 1, title: "All Saints' Day" },
  { month: 11, day: 2, title: "All Souls' Day" },
  { month: 11, day: 11, title: "Veterans Day (US)" },
  { month: 11, day: 30, title: "Bonifacio Day" },
  { month: 12, day: 24, title: "Christmas Eve" },
  { month: 12, day: 25, title: "Christmas Day" },
  { month: 12, day: 30, title: "Rizal Day" },
  { month: 12, day: 31, title: "New Year's Eve" },
];

function getNthWeekday(year: number, month: number, weekday: number, n: number): number {
  const first = new Date(year, month - 1, 1).getDay();
  let day = 1 + ((weekday - first + 7) % 7) + (n - 1) * 7;
  return day;
}

function getLastWeekday(year: number, month: number, weekday: number): number {
  const last = new Date(year, month, 0);
  const diff = (last.getDay() - weekday + 7) % 7;
  return last.getDate() - diff;
}

function getFloatingUSHolidays(year: number): { month: number; day: number; title: string }[] {
  return [
    { month: 1, day: getNthWeekday(year, 1, 1, 3), title: "Martin Luther King Jr. Day (US)" },
    { month: 2, day: getNthWeekday(year, 2, 1, 3), title: "Presidents' Day (US)" },
    { month: 5, day: getLastWeekday(year, 5, 1), title: "Memorial Day (US)" },
    { month: 9, day: getNthWeekday(year, 9, 1, 1), title: "Labor Day (US)" },
    { month: 10, day: getNthWeekday(year, 10, 1, 2), title: "Columbus Day (US)" },
    { month: 11, day: getNthWeekday(year, 11, 4, 4), title: "Thanksgiving (US)" },
  ];
}

export async function getCalendarEvents(year: number, month: number, includeLeaves = false): Promise<CalendarEvent[]> {
  await ensureTablesOnce();
  const events: CalendarEvent[] = [];

  const allHolidays = [...HOLIDAYS, ...getFloatingUSHolidays(year)];
  for (const h of allHolidays) {
    if (h.month === month) {
      events.push({ date: `${year}-${String(h.month).padStart(2, "0")}-${String(h.day).padStart(2, "0")}`, title: h.title, type: "holiday" });
    }
  }

  function parseFlexDate(s: string): { year: number; month: number; day: number } | null {
    if (!s || !s.trim()) return null;
    const d = new Date(s);
    if (!isNaN(d.getTime())) return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
    const dashParts = s.split("-");
    if (dashParts.length >= 3) {
      const y = parseInt(dashParts[0]); const m = parseInt(dashParts[1]); const dy = parseInt(dashParts[2]);
      if (y && m && dy) return { year: y, month: m, day: dy };
    }
    const slashParts = s.split("/");
    if (slashParts.length >= 3) {
      const m = parseInt(slashParts[0]); const dy = parseInt(slashParts[1]); const y = parseInt(slashParts[2]);
      if (y && m && dy) return { year: y, month: m, day: dy };
    }
    return null;
  }

  const { rows } = await sql`SELECT id, first_name, last_name, date_of_birth, date_hired FROM va_profiles`;
  for (const r of rows) {
    const dobParsed = parseFlexDate(r.date_of_birth as string);
    if (dobParsed && dobParsed.month === month) {
      events.push({
        date: `${year}-${String(dobParsed.month).padStart(2, "0")}-${String(dobParsed.day).padStart(2, "0")}`,
        title: `${r.first_name} ${r.last_name}'s Birthday`,
        type: "birthday",
        vaId: r.id as string,
      });
    }

    const hiredParsed = parseFlexDate(r.date_hired as string);
    if (hiredParsed && hiredParsed.month === month && hiredParsed.year < year) {
      const yearsWorked = year - hiredParsed.year;
      events.push({
        date: `${year}-${String(hiredParsed.month).padStart(2, "0")}-${String(hiredParsed.day).padStart(2, "0")}`,
        title: `${r.first_name} ${r.last_name}'s ${yearsWorked}-Year Work Anniversary`,
        type: "anniversary",
        vaId: r.id as string,
      });
    }
  }

  const { rows: customRows } = await sql`
    SELECT id, event_date, title, event_type FROM calendar_events
    WHERE event_date LIKE ${`${year}-${String(month).padStart(2, "0")}%`}
  `;
  for (const r of customRows) {
    events.push({
      date: r.event_date as string,
      title: r.title as string,
      type: (r.event_type as CalendarEvent["type"]) || "event",
      id: r.id as number,
    });
  }

  if (includeLeaves) {
    const monthStr = `${year}-${String(month).padStart(2, "0")}`;
    const { rows: leaveRows } = await sql`
      SELECT lr.va_id, lr.date_from, lr.date_to, lr.type, vp.first_name, vp.last_name
      FROM leave_requests lr
      JOIN va_profiles vp ON vp.id = lr.va_id
      WHERE lr.status = 'Approved'
        AND lr.date_from <= ${monthStr + "-31"}
        AND lr.date_to >= ${monthStr + "-01"}
    `;
    for (const r of leaveRows) {
      const from = new Date(r.date_from as string);
      const to = new Date(r.date_to as string);
      const monthStart = new Date(year, month - 1, 1);
      const monthEnd = new Date(year, month, 0);
      const start = from < monthStart ? monthStart : from;
      const end = to > monthEnd ? monthEnd : to;
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        events.push({
          date: dd,
          title: `${r.first_name} ${r.last_name} — ${r.type || "Leave"}`,
          type: "leave",
          vaId: r.va_id as string,
        });
      }
    }
  }

  events.sort((a, b) => a.date.localeCompare(b.date));
  return events;
}

export async function addCalendarEvent(eventDate: string, title: string, eventType: string): Promise<void> {
  await ensureTablesOnce();
  const now = estDateLong();
  await sql`INSERT INTO calendar_events (event_date, title, event_type, created_at) VALUES (${eventDate}, ${title}, ${eventType}, ${now})`;
}

export async function deleteCalendarEvent(id: number): Promise<void> {
  await sql`DELETE FROM calendar_events WHERE id = ${id}`;
}

// ── Auto-fill Timeproof from Schedule ──

// Kept as a no-op for older portal sessions still calling this server action.
// Schedule-based automatic punches for VA 500101 have been retired.
export async function autoFillScheduleTimeproof(_vaId: string): Promise<{ filled: boolean; count: number }> {
  return { filled: false, count: 0 };
}

// ── Online / Working Status ──

export async function getWorkingVAs(): Promise<{ id: string; firstName: string; lastName: string; position: string; clientName: string; timeIn: string }[]> {
  await ensureTablesOnce();
  const today = estDate();
  const { rows } = await sql`
    SELECT DISTINCT ON (vp.id) vp.id, vp.first_name, vp.last_name, vp.position, ca.display_name as client_name, te.time_in
    FROM timeproof_entries te
    JOIN va_profiles vp ON vp.id = te.va_id
    JOIN client_accounts ca ON ca.id = te.client_id
    WHERE te.punch_date = ${today}
      AND te.time_in != ''
      AND (te.time_out IS NULL OR te.time_out = '')
    ORDER BY vp.id, te.time_in ASC
  `;
  return rows.map((r) => ({
    id: r.id as string,
    firstName: r.first_name as string,
    lastName: r.last_name as string,
    position: r.position as string,
    clientName: (r.client_name as string) || "",
    timeIn: (r.time_in as string) || "",
  }));
}

// ── DB Init ──

// ── Notifications ──

export type { Notification } from "./notification-types";

export async function getNotifications(vaId: string) {
  await requireVAOrAdmin(vaId);
  await ensureTablesOnce();
  const notifications = await notificationService.recipientNotifications("va", vaId);
  wakeEmailDelivery();
  return notifications;
}

export async function getUnreadNotificationCount(vaId: string): Promise<number> {
  return (await getNotifications(vaId)).filter(n => !n.isRead).length;
}

export async function markNotificationRead(notificationId: number, vaId: string): Promise<void> {
  await requireVAOrAdmin(vaId);
  await ensureTablesOnce();
  await notificationService.readRecipientNotifications("va", vaId, notificationId);
}

export async function markAllNotificationsRead(vaId: string): Promise<void> {
  await requireVAOrAdmin(vaId);
  await ensureTablesOnce();
  await notificationService.readRecipientNotifications("va", vaId);
}

async function authenticatedClientRecipient(email: string) {
  const client = await requireClientSession();
  if (client.email.toLowerCase() !== email.trim().toLowerCase()) throw new Error("Client account does not match your session.");
  return String(client.id);
}

export async function getClientNotifications(email: string) {
  const recipientId = await authenticatedClientRecipient(email);
  await ensureTablesOnce();
  const notifications = await notificationService.recipientNotifications("client", recipientId);
  wakeEmailDelivery();
  return notifications;
}

export async function getClientUnreadNotificationCount(email: string): Promise<number> {
  return (await getClientNotifications(email)).filter(n => !n.isRead).length;
}

export async function markClientNotificationRead(notificationId: number, email: string): Promise<void> {
  const recipientId = await authenticatedClientRecipient(email);
  await ensureTablesOnce();
  await notificationService.readRecipientNotifications("client", recipientId, notificationId);
}

export async function markAllClientNotificationsRead(email: string): Promise<void> {
  const recipientId = await authenticatedClientRecipient(email);
  await ensureTablesOnce();
  await notificationService.readRecipientNotifications("client", recipientId);
}

export async function createNotification(data: NotificationInput): Promise<void> {
  await requireAdminSession();
  await ensureTablesOnce();
  await notificationService.saveNotification(data);
  wakeEmailDelivery();
}

export async function beginNotificationImageUpload(data: { contentType: string; size: number }) {
  await requireAdminSession();
  await ensureTablesOnce();
  return beginImageUpload(data);
}

export async function uploadNotificationImageChunk(id: string, index: number, data: string): Promise<void> {
  await requireAdminSession();
  await ensureTablesOnce();
  await appendImageChunk(id, index, data);
}

export async function deleteNotification(id: number): Promise<void> {
  await requireAdminSession();
  await ensureTablesOnce();
  await notificationService.removeNotification(id);
}

export async function deleteNotificationSchedule(id: number): Promise<void> {
  await requireAdminSession();
  await ensureTablesOnce();
  await notificationService.removeNotificationSchedule(id);
}

export async function getAllNotifications() {
  await requireAdminSession();
  await ensureTablesOnce();
  const notifications = await notificationService.adminNotifications();
  wakeEmailDelivery();
  return notifications;
}

export async function processScheduledNotifications(): Promise<void> {
  await ensureTablesOnce();
  await notificationService.processNotificationMaintenance();
}

export async function generateBiweeklyReminders(): Promise<void> {
  await ensureTablesOnce();
  const now = new Date();
  const estNow = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
  if (estNow.getDay() !== 5) return;

  const BIWEEKLY_ANCHOR = new Date(2026, 9, 5);
  const todayDate = new Date(estNow.getFullYear(), estNow.getMonth(), estNow.getDate());
  const diffDays = Math.floor((todayDate.getTime() - BIWEEKLY_ANCHOR.getTime()) / 86400000);
  const periodIndex = Math.floor(diffDays / 14);
  const periodStart = new Date(BIWEEKLY_ANCHOR);
  periodStart.setDate(periodStart.getDate() + periodIndex * 14);
  const periodEnd = new Date(periodStart);
  periodEnd.setDate(periodEnd.getDate() + 13);

  const lastFriday = new Date(periodStart);
  lastFriday.setDate(lastFriday.getDate() + 11);

  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  if (fmt(todayDate) !== fmt(lastFriday)) return;

  const todayLong = estDateLong();
  const { rows: existing } = await sql`SELECT id FROM notifications WHERE type = 'reminder' AND title = 'Biweekly Reminder' AND created_at = ${todayLong} LIMIT 1`;
  if (existing.length > 0) return;

  const startStr = periodStart.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const endStr = periodEnd.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  await sql`INSERT INTO notifications (va_id, title, message, type, created_at, created_by) VALUES ('', 'Biweekly Reminder', ${`Please finalize your weekly reports and send your invoices for the period ${startStr} – ${endStr}.`}, 'reminder', ${todayLong}, 'system')`;
}

// ── DB Init ──

export async function initDatabase(): Promise<{ created: boolean }> {
  const { ensureTables } = await import("./db");
  await ensureTables();

  const { rows } = await sql`SELECT COUNT(*) as cnt FROM va_profiles`;
  const count = parseInt(rows[0].cnt as string) || 0;
  if (count > 0) return { created: false };

  const { vaProfiles: seedProfiles, leaveRequests: seedRequests } = await import("./data");
  for (const p of seedProfiles) {
    await addProfile(p);
  }
  for (const [vaId, reqs] of Object.entries(seedRequests)) {
    for (const req of reqs) {
      await addRequest(vaId, req);
    }
  }
  return { created: true };
}


export async function getClientRequests() {
  const client = await requireClientSession();
  await ensureTablesOnce();
  const { rows } = await sql`SELECT r.*,p.first_name,p.last_name,c.display_name AS client_name
    FROM leave_requests r JOIN va_profiles p ON p.id=r.va_id JOIN client_accounts c ON c.id=r.client_id
    WHERE r.client_id=${client.id} AND EXISTS(SELECT 1 FROM va_client_assignments a WHERE a.va_id=r.va_id AND a.client_id=${client.id})
    ORDER BY r.request_id DESC`;
  return rows.map(r => ({ vaId: String(r.va_id), vaName: `${r.first_name} ${r.last_name}`, request: rowToRequest(r) }));
}
export async function reviewClientRequest(id: string, decision: LeaveRequest["status"], remarks?: string) {
  const client = await requireClientSession();
  await ensureTablesOnce();
  await reviewRequest("leave",id,decision,{ role: "client",name: client.email,clientId: client.id },remarks);
  wakeEmailDelivery();
}
export async function updateClientRequestRemarks(id: string, remarks: string) {
  const client = await requireClientSession();
  if (typeof remarks !== "string" || remarks.length > 5000) throw new Error("Enter remarks up to 5,000 characters.");
  await ensureTablesOnce();
  const { rows } = await sql`UPDATE leave_requests r SET client_remarks=${remarks},remarks=concat_ws(E'\n',NULLIF(admin_remarks,''),NULLIF(${remarks},''))
    WHERE r.request_id=${id} AND r.client_id=${client.id} AND EXISTS(SELECT 1 FROM va_client_assignments a WHERE a.va_id=r.va_id AND a.client_id=${client.id}) RETURNING request_id`;
  if (!rows.length) throw new Error("Request not found or access denied.");
}
export async function getClientOvertimeRequests() {
  const client = await requireClientSession();
  await ensureTablesOnce();
  const { rows } = await sql`SELECT e.*,p.first_name,p.last_name FROM timeproof_entries e JOIN va_profiles p ON p.id=e.va_id
    WHERE e.entry_type='overtime' AND e.client_id=${client.id}
    AND EXISTS(SELECT 1 FROM va_client_assignments a WHERE a.va_id=e.va_id AND a.client_id=${client.id}) ORDER BY e.id DESC`;
  return rows.map(r => ({ ...rowToTimeproofEntry(r), vaName: `${r.first_name} ${r.last_name}` }));
}
export async function reviewClientOvertime(id: number, decision: "Pending" | "Approved" | "Denied") {
  const client = await requireClientSession();
  await ensureTablesOnce();
  await reviewRequest("overtime",id,decision,{ role: "client",name: client.email,clientId: client.id });
  wakeEmailDelivery();
}
