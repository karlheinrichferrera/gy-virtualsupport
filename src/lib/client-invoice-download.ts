import { sql } from "@vercel/postgres";
import { getAdminSession } from "./admin-session";
import { getClientSession } from "./client-session";
import { ensureTables } from "./db";
import type { ClientInvoice } from "./actions";
import type { InvoiceLineItem } from "./client-invoice-format";

export async function clientInvoiceDownload(id: number): Promise<{ status: 401 | 404 } | { invoice: ClientInvoice }> {
  const admin = await getAdminSession();
  const client = admin ? null : await getClientSession();
  if (!admin && !client) return { status: 401 };
  await ensureTables();
  const { rows } = await sql`SELECT * FROM client_invoices
    WHERE id=${id} AND invoice_layout='itemized'
      AND (${Boolean(admin)} OR (client_id=${client?.id ?? null} AND LOWER(TRIM(status))!='draft'))`;
  if (!rows.length) return { status: 404 };
  const row = rows[0];
  return { invoice: { id: Number(row.id), clientId: Number(row.client_id), invoiceNumber: String(row.invoice_number),
    billCoverage: String(row.bill_coverage), amount: String(row.amount), invoiceDueDate: String(row.invoice_due_date),
    status: String(row.status), invoiceLink: String(row.invoice_link || ''), invoiceLayout: 'itemized',
    lineItems: row.line_items as InvoiceLineItem[], paymentLink: String(row.payment_link || ''),
    billToName: String(row.bill_to_name || ''), billToCompany: String(row.bill_to_company || '') } };
}
