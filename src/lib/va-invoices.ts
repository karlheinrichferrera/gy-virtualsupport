import { sql } from "@vercel/postgres";
import type { Invoice } from "./data";
import type { AdminSession } from "./admin-session";

function validateInvoiceDetails(updates: Partial<Invoice>) {
  if (!updates || typeof updates !== "object" || Array.isArray(updates)) throw new Error("Invalid invoice details.");
  for (const field of ["dateCovered", "amount", "transactionFee", "amountDisbursed", "invoiceCopy"] as const) {
    if (updates[field] !== undefined && typeof updates[field] !== "string") throw new Error("Invalid invoice details.");
  }
  if (updates.clientId !== undefined && (!Number.isSafeInteger(updates.clientId) || updates.clientId < 0)) throw new Error("Invalid invoice client.");
}

/** Submission and acknowledgement commit together; retries reuse the same submission key. */
export async function submitVAInvoice(vaId: string, invoice: Invoice, submissionKey?: string) {
  validateInvoiceDetails(invoice);
  if (!invoice.invoiceNumber?.trim() || !invoice.amount?.trim() || !["Pending", "Draft"].includes(invoice.status)) throw new Error("Submit a Pending or Draft invoice with an invoice number and amount.");
  if (submissionKey !== undefined && !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(submissionKey)) throw new Error("Refresh the invoice form and try again.");
  const { rows } = await sql`WITH submitted AS (
    INSERT INTO invoices(va_id,client_id,invoice_number,date_covered,amount,transaction_fee,amount_disbursed,invoice_copy,status,submission_key)
    VALUES (${vaId},${invoice.clientId || 0},${invoice.invoiceNumber},${invoice.dateCovered},${invoice.amount},${invoice.transactionFee},${invoice.amountDisbursed},${invoice.invoiceCopy},${invoice.status},${submissionKey ?? null}::uuid)
    ON CONFLICT (submission_key) DO NOTHING RETURNING *
  ), receipts AS (
    INSERT INTO notifications(va_id,audience,title,message,type,created_by,created_at,redirect_to)
    SELECT va_id,'va','VA Invoice - Acknowledgement',
      'We have received your invoice ' || invoice_number || '. It is pending review and payment.' ||
      E'\nBilling period: ' || date_covered || E'\nInvoice amount: ' || amount,
      'payment','system',${new Date().toISOString()},'/dashboard/invoices'
    FROM submitted WHERE status='Pending' RETURNING id
  ) SELECT (SELECT COUNT(*) FROM submitted) AS submitted_count,(SELECT COUNT(*) FROM receipts) AS notification_count`;
  if (!Number(rows[0].submitted_count)) {
    const existing = await sql`SELECT * FROM invoices WHERE submission_key=${submissionKey}::uuid`;
    const row = existing.rows[0];
    if (!row || row.va_id !== vaId || row.invoice_number !== invoice.invoiceNumber || row.date_covered !== invoice.dateCovered ||
      row.amount !== invoice.amount || row.transaction_fee !== invoice.transactionFee || row.amount_disbursed !== invoice.amountDisbursed ||
      row.invoice_copy !== invoice.invoiceCopy || Number(row.client_id) !== (invoice.clientId || 0)) {
      throw new Error("This submission was already used for another invoice. Start a new invoice.");
    }
  }
}

/** Both the admin edit form and Mark Paid action use this atomic status transition. */
export async function saveVAInvoice(invoiceNumber: string, updates: Partial<Invoice>, admin: AdminSession | null) {
  validateInvoiceDetails(updates);
  if (updates.status !== undefined) {
    if (!admin) throw new Error("Only an administrator can change an invoice's payment status.");
    if (!["Paid", "Pending", "Draft", ""].includes(updates.status)) throw new Error("Invalid invoice status.");
  }
  const { rows: matches } = await sql`SELECT id FROM invoices WHERE invoice_number=${invoiceNumber} ORDER BY id LIMIT 2`;
  if (matches.length !== 1) throw new Error(matches.length ? "More than one invoice uses this number. Contact an administrator to correct the duplicate." : "Invoice not found. Refresh the invoice list and try again.");
  const { rows } = await sql`WITH previous AS MATERIALIZED (
    SELECT * FROM invoices WHERE id=${matches[0].id as number} FOR UPDATE
  ), changed AS (
    UPDATE invoices i SET
      client_id=COALESCE(${updates.clientId ?? null}::integer,previous.client_id),
      date_covered=COALESCE(${updates.dateCovered ?? null},previous.date_covered),
      amount=COALESCE(${updates.amount ?? null},previous.amount),
      transaction_fee=COALESCE(${updates.transactionFee ?? null},previous.transaction_fee),
      amount_disbursed=COALESCE(${updates.amountDisbursed ?? null},previous.amount_disbursed),
      invoice_copy=COALESCE(${updates.invoiceCopy ?? null},previous.invoice_copy),
      status=COALESCE(${updates.status ?? null},previous.status)
    FROM previous WHERE i.id=previous.id AND (${Boolean(admin)} OR LOWER(TRIM(previous.status))!='paid')
    RETURNING i.*,previous.status AS previous_status
  ), notices AS (
    INSERT INTO notifications(va_id,audience,title,message,type,created_by,created_at,redirect_to)
    SELECT va_id,'va','VA Invoice - Paid',
      'Your invoice ' || invoice_number || ' has been marked as paid.' ||
      E'\nBilling period: ' || date_covered || E'\nInvoice amount: ' || amount ||
      CASE WHEN transaction_fee!='' THEN E'\nTransaction fee: ' || transaction_fee ELSE '' END ||
      CASE WHEN amount_disbursed!='' THEN E'\nAmount disbursed: ' || amount_disbursed ELSE '' END,
      'payment',${admin?.username || "system"},${new Date().toISOString()},'/dashboard/invoices'
    FROM changed WHERE LOWER(TRIM(status))='paid' AND LOWER(TRIM(previous_status))!='paid' RETURNING id
  ) SELECT (SELECT COUNT(*) FROM changed) AS updated_count,(SELECT COUNT(*) FROM notices) AS notification_count`;
  if (Number(rows[0].updated_count)!==1) throw new Error("Paid invoices can only be changed by an administrator. Refresh the invoice list and try again.");
}
