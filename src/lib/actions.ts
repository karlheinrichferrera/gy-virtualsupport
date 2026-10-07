"use server";

import { sql } from "@vercel/postgres";
import type { VAProfile, SalaryAdjustment, Invoice, LeaveRequest } from "./data";

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
  };
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
  await sql`
    INSERT INTO va_profiles (
      id, first_name, middle_name, last_name, suffix,
      phone, alt_phone, email, date_of_birth,
      addr_street, addr_subdivision, addr_barangay, addr_city, addr_province, addr_postal_code,
      temporary_address, position, employment_status, date_hired, current_rate,
      emergency_contact, emergency_phone, password, contractor_id,
      payout_mode, paypal_link, ewallet_name, ewallet_number,
      bank_name, bank_account_number, bank_account_name
    ) VALUES (
      ${p.id}, ${p.firstName}, ${p.middleName}, ${p.lastName}, ${p.suffix},
      ${p.phone}, ${p.altPhone}, ${p.email}, ${p.dateOfBirth},
      ${p.permanentAddress.street}, ${p.permanentAddress.subdivision}, ${p.permanentAddress.barangay},
      ${p.permanentAddress.city}, ${p.permanentAddress.province}, ${p.permanentAddress.postalCode},
      ${p.temporaryAddress}, ${p.position}, ${p.employmentStatus}, ${p.dateHired}, ${p.currentRate},
      ${p.emergencyContact}, ${p.emergencyPhone}, ${p.password}, ${p.contractorId},
      ${p.payoutMode}, ${p.paypalLink}, ${p.ewalletName}, ${p.ewalletNumber},
      ${p.bankName}, ${p.bankAccountNumber}, ${p.bankAccountName}
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
      bank_account_name = ${merged.bankAccountName}
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

export async function getAdjustmentsFor(vaId: string): Promise<(SalaryAdjustment & { id: number })[]> {
  const { rows } = await sql`SELECT * FROM salary_adjustments WHERE va_id = ${vaId} ORDER BY id`;
  return rows.map(rowToAdjustment);
}

export async function getAllAdjustments(): Promise<Record<string, (SalaryAdjustment & { id: number })[]>> {
  const { rows } = await sql`SELECT * FROM salary_adjustments ORDER BY id`;
  const map: Record<string, (SalaryAdjustment & { id: number })[]> = {};
  for (const r of rows) {
    const vaId = r.va_id as string;
    if (!map[vaId]) map[vaId] = [];
    map[vaId].push(rowToAdjustment(r));
  }
  return map;
}

export async function addAdjustment(vaId: string, adj: SalaryAdjustment): Promise<void> {
  await sql`
    INSERT INTO salary_adjustments (va_id, effectivity_date, type, hourly_rate, sales_commission, referral_bonus, notes)
    VALUES (${vaId}, ${adj.effectivityDate}, ${adj.type}, ${adj.hourlyRate}, ${adj.salesCommission}, ${adj.referralBonus}, ${adj.notes})
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

export async function getAllInvoicesFlat(): Promise<{ vaId: string; vaName: string; invoice: Invoice }[]> {
  const { rows } = await sql`
    SELECT i.*, p.first_name, p.last_name
    FROM invoices i
    JOIN va_profiles p ON i.va_id = p.id
    WHERE i.invoice_number != '' AND i.amount != ''
    ORDER BY i.id
  `;
  return rows.map((r) => ({
    vaId: r.va_id as string,
    vaName: `${r.first_name} ${r.last_name}`,
    invoice: rowToInvoice(r),
  }));
}

export async function addInvoice(vaId: string, inv: Invoice): Promise<void> {
  await sql`
    INSERT INTO invoices (va_id, invoice_number, date_covered, amount, transaction_fee, amount_disbursed, invoice_copy, status)
    VALUES (${vaId}, ${inv.invoiceNumber}, ${inv.dateCovered}, ${inv.amount}, ${inv.transactionFee}, ${inv.amountDisbursed}, ${inv.invoiceCopy}, ${inv.status})
  `;
}

export async function updateInvoice(invoiceNumber: string, updates: Partial<Invoice>): Promise<void> {
  const { rows } = await sql`SELECT * FROM invoices WHERE invoice_number = ${invoiceNumber}`;
  if (rows.length === 0) return;
  const current = rowToInvoice(rows[0]);
  const merged = { ...current, ...updates };
  await sql`
    UPDATE invoices SET
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
