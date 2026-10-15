"use server";

import { sql } from "@vercel/postgres";
import type { VAProfile, SalaryAdjustment, Invoice, LeaveRequest } from "./data";
import { estDate, estDateLong } from "./est";

let tablesReady = false;
async function ensureTablesOnce() {
  if (tablesReady) return;
  const { ensureTables } = await import("./db");
  await ensureTables();
  tablesReady = true;
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
    password: r.password as string,
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
}

export async function updateProfile(id: string, updates: Partial<VAProfile>): Promise<void> {
  const current = await getProfile(id);
  if (!current) return;
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
}

export async function deleteProfile(id: string): Promise<void> {
  await sql`DELETE FROM va_profiles WHERE id = ${id}`;
}

export async function resetPassword(id: string): Promise<void> {
  await sql`UPDATE va_profiles SET password = 'gyva2026' WHERE id = ${id}`;
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
  await sql`
    INSERT INTO salary_adjustments (va_id, effectivity_date, type, hourly_rate, sales_commission, referral_bonus, notes)
    VALUES (${vaId}, ${adj.effectivityDate}, ${adj.type}, ${adj.hourlyRate}, ${adj.salesCommission}, ${adj.referralBonus}, ${adj.notes})
  `;
}

export async function updateAdjustment(adjId: number, vaId: string, adj: SalaryAdjustment): Promise<void> {
  await sql`
    UPDATE salary_adjustments
    SET va_id = ${vaId}, effectivity_date = ${adj.effectivityDate}, type = ${adj.type},
        hourly_rate = ${adj.hourlyRate}, sales_commission = ${adj.salesCommission},
        referral_bonus = ${adj.referralBonus}, notes = ${adj.notes}
    WHERE id = ${adjId}
  `;
}

export async function deleteAdjustment(adjId: number): Promise<void> {
  await sql`DELETE FROM salary_adjustments WHERE id = ${adjId}`;
}

// ── Invoices ──

export async function getInvoicesFor(vaId: string): Promise<Invoice[]> {
  const { rows } = await sql`SELECT * FROM invoices WHERE va_id = ${vaId} ORDER BY id`;
  return rows.map(rowToInvoice);
}

export async function getAllInvoicesFlat(): Promise<{ vaId: string; vaName: string; clientName: string; invoice: Invoice }[]> {
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

export async function addInvoice(vaId: string, inv: Invoice): Promise<void> {
  await sql`
    INSERT INTO invoices (va_id, client_id, invoice_number, date_covered, amount, transaction_fee, amount_disbursed, invoice_copy, status)
    VALUES (${vaId}, ${inv.clientId || 0}, ${inv.invoiceNumber}, ${inv.dateCovered}, ${inv.amount}, ${inv.transactionFee}, ${inv.amountDisbursed}, ${inv.invoiceCopy}, ${inv.status})
  `;
}

export async function updateInvoice(invoiceNumber: string, updates: Partial<Invoice>): Promise<void> {
  const { rows } = await sql`SELECT * FROM invoices WHERE invoice_number = ${invoiceNumber}`;
  if (rows.length === 0) return;
  const current = rowToInvoice(rows[0]);
  const merged = { ...current, ...updates };
  await sql`
    UPDATE invoices SET
      client_id = ${merged.clientId || 0},
      date_covered = ${merged.dateCovered},
      amount = ${merged.amount},
      transaction_fee = ${merged.transactionFee},
      amount_disbursed = ${merged.amountDisbursed},
      invoice_copy = ${merged.invoiceCopy},
      status = ${merged.status}
    WHERE invoice_number = ${invoiceNumber}
  `;
}

export async function updateInvoiceStatus(invoiceNumber: string, status: Invoice["status"]): Promise<void> {
  await sql`UPDATE invoices SET status = ${status} WHERE invoice_number = ${invoiceNumber}`;
}

export async function deleteInvoice(invoiceNumber: string): Promise<void> {
  await sql`DELETE FROM invoices WHERE invoice_number = ${invoiceNumber}`;
}

export async function generateNextInvoiceNumber(vaId: string): Promise<string> {
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
  const { rows } = await sql`SELECT * FROM leave_requests WHERE va_id = ${vaId} ORDER BY request_id`;
  return rows.map(rowToRequest);
}

export async function getAllRequestsFlat(): Promise<{ vaId: string; vaName: string; request: LeaveRequest }[]> {
  const { rows } = await sql`
    SELECT r.*, p.first_name, p.last_name
    FROM leave_requests r
    JOIN va_profiles p ON r.va_id = p.id
    ORDER BY r.request_id
  `;
  return rows.map((r) => ({
    vaId: r.va_id as string,
    vaName: `${r.first_name} ${r.last_name}`,
    request: rowToRequest(r),
  }));
}

export async function addRequest(vaId: string, req: LeaveRequest): Promise<void> {
  await sql`
    INSERT INTO leave_requests (request_id, va_id, type, date_submitted, date_from, date_to, reason, status, remarks)
    VALUES (${req.id}, ${vaId}, ${req.type}, ${req.dateSubmitted}, ${req.dateFrom}, ${req.dateTo}, ${req.reason}, ${req.status}, ${req.remarks})
  `;
}

export async function updateRequestStatus(id: string, status: LeaveRequest["status"], remarks?: string): Promise<void> {
  if (remarks !== undefined) {
    await sql`UPDATE leave_requests SET status = ${status}, remarks = ${remarks} WHERE request_id = ${id}`;
  } else {
    await sql`UPDATE leave_requests SET status = ${status} WHERE request_id = ${id}`;
  }
}

export async function updateRequestDetails(
  id: string,
  updates: { type?: LeaveRequest["type"]; dateFrom?: string; dateTo?: string; reason?: string }
): Promise<void> {
  const sets: string[] = [];
  const vals: string[] = [];
  if (updates.type !== undefined) { sets.push("type"); vals.push(updates.type); }
  if (updates.dateFrom !== undefined) { sets.push("date_from"); vals.push(updates.dateFrom); }
  if (updates.dateTo !== undefined) { sets.push("date_to"); vals.push(updates.dateTo); }
  if (updates.reason !== undefined) { sets.push("reason"); vals.push(updates.reason); }
  if (sets.length === 0) return;
  await sql.query(
    `UPDATE leave_requests SET ${sets.map((s, i) => `${s} = $${i + 1}`).join(", ")} WHERE request_id = $${sets.length + 1}`,
    [...vals, id]
  );
}

export async function updateRequestRemarks(id: string, remarks: string): Promise<void> {
  await sql`UPDATE leave_requests SET remarks = ${remarks} WHERE request_id = ${id}`;
}

export async function deleteRequest(id: string): Promise<void> {
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
  return { id: r.id as number, username: r.username as string, displayName: r.display_name as string, createdAt: r.created_at as string };
}

export async function getAdminAccounts(): Promise<AdminAccount[]> {
  await ensureTablesOnce();
  const { rows } = await sql`SELECT id, username, display_name, created_at FROM admin_accounts ORDER BY id`;
  return rows.map((r) => ({ id: r.id as number, username: r.username as string, displayName: r.display_name as string, createdAt: r.created_at as string }));
}

export async function addAdminAccount(username: string, password: string, displayName: string): Promise<{ success: boolean; error?: string }> {
  await ensureTablesOnce();
  const { rows } = await sql`SELECT id FROM admin_accounts WHERE username = ${username}`;
  if (rows.length > 0) return { success: false, error: "Username already exists" };
  const now = estDateLong();
  await sql`INSERT INTO admin_accounts (username, password, display_name, created_at) VALUES (${username}, ${password}, ${displayName}, ${now})`;
  return { success: true };
}

export async function changeAdminPassword(username: string, currentPassword: string, newPassword: string): Promise<{ success: boolean; error?: string }> {
  await ensureTablesOnce();
  const { rows } = await sql`SELECT id FROM admin_accounts WHERE username = ${username} AND password = ${currentPassword}`;
  if (rows.length === 0) return { success: false, error: "Current password is incorrect" };
  await sql`UPDATE admin_accounts SET password = ${newPassword} WHERE username = ${username}`;
  return { success: true };
}

export async function deleteAdminAccount(id: number): Promise<{ success: boolean; error?: string }> {
  const { rows } = await sql`SELECT COUNT(*) as cnt FROM admin_accounts`;
  const count = parseInt(rows[0].cnt as string) || 0;
  if (count <= 1) return { success: false, error: "Cannot delete the last admin account" };
  await sql`DELETE FROM admin_accounts WHERE id = ${id}`;
  return { success: true };
}

export async function resetAdminPassword(id: number): Promise<void> {
  await sql`UPDATE admin_accounts SET password = 'gyadmin2026' WHERE id = ${id}`;
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
  };
}

export async function authenticateClient(email: string, password: string): Promise<ClientAccount | null> {
  await ensureTablesOnce();
  const { rows } = await sql`SELECT * FROM client_accounts WHERE email = ${email} AND password = ${password}`;
  if (rows.length === 0) return null;
  return rowToClientAccount(rows[0]);
}

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
  await ensureTablesOnce();
  const { rows } = await sql`SELECT id FROM client_accounts WHERE email = ${email}`;
  if (rows.length > 0) return { success: false, error: "Email already exists" };
  const now = estDateLong();
  await sql`INSERT INTO client_accounts (email, password, display_name, company_name, address, phone, created_at) VALUES (${email}, ${password}, ${displayName}, ${companyName || ""}, ${address || ""}, ${phone || ""}, ${now})`;
  return { success: true };
}

export async function updateClientAccount(id: number, updates: { displayName?: string; companyName?: string; address?: string; phone?: string; email?: string; timesheetUrl?: string; timesheetViewUrl?: string }): Promise<void> {
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
  await sql`UPDATE client_accounts SET password = 'gyclient2026' WHERE id = ${id}`;
}

export async function changeClientPassword(email: string, currentPassword: string, newPassword: string): Promise<{ success: boolean; error?: string }> {
  await ensureTablesOnce();
  const { rows } = await sql`SELECT id FROM client_accounts WHERE email = ${email} AND password = ${currentPassword}`;
  if (rows.length === 0) return { success: false, error: "Current password is incorrect" };
  await sql`UPDATE client_accounts SET password = ${newPassword} WHERE email = ${email}`;
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
  };
}

export async function getClientInvoices(): Promise<ClientInvoice[]> {
  await ensureTablesOnce();
  const { rows } = await sql`SELECT * FROM client_invoices ORDER BY id DESC`;
  return rows.map(rowToClientInvoice);
}

export async function getClientInvoicesByClientId(clientId: number): Promise<ClientInvoice[]> {
  await ensureTablesOnce();
  const { rows } = await sql`SELECT * FROM client_invoices WHERE client_id = ${clientId} ORDER BY id DESC`;
  return rows.map(rowToClientInvoice);
}

export async function getClientInvoicesByEmail(email: string): Promise<ClientInvoice[]> {
  await ensureTablesOnce();
  const { rows: acctRows } = await sql`SELECT id FROM client_accounts WHERE email = ${email}`;
  if (acctRows.length === 0) return [];
  const clientId = acctRows[0].id as number;
  return getClientInvoicesByClientId(clientId);
}

export async function addClientInvoice(inv: Omit<ClientInvoice, "id">): Promise<void> {
  await ensureTablesOnce();
  await sql`
    INSERT INTO client_invoices (client_id, invoice_number, bill_coverage, amount, invoice_due_date, status, invoice_link)
    VALUES (${inv.clientId}, ${inv.invoiceNumber}, ${inv.billCoverage}, ${inv.amount}, ${inv.invoiceDueDate}, ${inv.status}, ${inv.invoiceLink})
  `;
}

export async function updateClientInvoice(id: number, inv: Omit<ClientInvoice, "id">): Promise<void> {
  await ensureTablesOnce();
  await sql`
    UPDATE client_invoices SET
      client_id = ${inv.clientId},
      invoice_number = ${inv.invoiceNumber},
      bill_coverage = ${inv.billCoverage},
      amount = ${inv.amount},
      invoice_due_date = ${inv.invoiceDueDate},
      status = ${inv.status},
      invoice_link = ${inv.invoiceLink}
    WHERE id = ${id}
  `;
}

export async function deleteClientInvoice(id: number): Promise<void> {
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

export type TimeproofEntry = {
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
  await ensureTablesOnce();
  const { rows } = await sql`SELECT * FROM timeproof_entries WHERE va_id = ${vaId} ORDER BY punch_date DESC, time_in DESC`;
  return rows.map(rowToTimeproofEntry);
}

export async function getTimeproofEntriesForVAClient(vaId: string, clientId: number): Promise<TimeproofEntry[]> {
  await ensureTablesOnce();
  const { rows } = await sql`SELECT * FROM timeproof_entries WHERE va_id = ${vaId} AND client_id = ${clientId} ORDER BY punch_date DESC, time_in DESC`;
  return rows.map(rowToTimeproofEntry);
}

export async function getTimeproofEntriesByClientEmail(email: string): Promise<(TimeproofEntry & { vaName: string })[]> {
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

export async function addTimeproofEntry(entry: Omit<TimeproofEntry, "id">): Promise<void> {
  await ensureTablesOnce();
  await sql`
    INSERT INTO timeproof_entries (va_id, client_id, punch_date, time_in, time_out, notes, created_at, entry_type, status)
    VALUES (${entry.vaId}, ${entry.clientId}, ${entry.punchDate}, ${entry.timeIn}, ${entry.timeOut}, ${entry.notes}, ${entry.createdAt}, ${entry.entryType || "time"}, ${entry.status || "approved"})
  `;
}

export async function addBulkTimeproofEntries(entries: Omit<TimeproofEntry, "id">[]): Promise<void> {
  await ensureTablesOnce();
  for (const entry of entries) {
    await sql`
      INSERT INTO timeproof_entries (va_id, client_id, punch_date, time_in, time_out, notes, created_at, entry_type, status)
      VALUES (${entry.vaId}, ${entry.clientId}, ${entry.punchDate}, ${entry.timeIn}, ${entry.timeOut}, ${entry.notes}, ${entry.createdAt}, ${entry.entryType || "time"}, ${entry.status || "approved"})
    `;
  }
}

export async function updateTimeproofEntry(id: number, updates: { timeIn?: string; timeOut?: string; notes?: string; punchDate?: string; entryType?: string }): Promise<void> {
  await ensureTablesOnce();
  const { rows } = await sql`SELECT * FROM timeproof_entries WHERE id = ${id}`;
  if (rows.length === 0) return;
  const current = rowToTimeproofEntry(rows[0]);
  await sql`
    UPDATE timeproof_entries SET
      punch_date = ${updates.punchDate ?? current.punchDate},
      time_in = ${updates.timeIn ?? current.timeIn},
      time_out = ${updates.timeOut ?? current.timeOut},
      notes = ${updates.notes ?? current.notes},
      entry_type = ${updates.entryType ?? current.entryType}
    WHERE id = ${id}
  `;
}

export async function deleteTimeproofEntry(id: number): Promise<void> {
  await sql`DELETE FROM timeproof_entries WHERE id = ${id}`;
}

export async function updateTimeproofEntryStatus(id: number, status: string): Promise<void> {
  await ensureTablesOnce();
  await sql`UPDATE timeproof_entries SET status = ${status} WHERE id = ${id}`;
}

export async function getPendingOvertimeRequests(): Promise<(TimeproofEntry & { vaName: string; clientName: string })[]> {
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
