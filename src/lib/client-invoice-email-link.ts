import { sql } from "@vercel/postgres";
import { ensureTables } from "./db";
import type { ClientInvoice } from "./actions";
import { DEFAULT_INVOICE_PAYMENT_LINK, type InvoiceLineItem } from "./client-invoice-format";

let ready: Promise<void> | undefined;

/** The unique link grants access to this invoice only; no sequential invoice ID is public. */
export async function emailedClientInvoice(token: string): Promise<ClientInvoice | null> {
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(token)) return null;
  ready ??= ensureTables().catch(error => { ready = undefined; throw error; });
  await ready;
  const { rows } = await sql`SELECT i.*,c.display_name,c.company_name
    FROM email_jobs j JOIN client_invoices i ON i.id=j.source_id JOIN client_accounts c ON c.id=i.client_id
    WHERE j.invoice_pdf_token=${token}::uuid AND j.source='invoice'
      AND j.status IN ('queued','sending','accepted','uncertain')
      AND j.template_data->>'clientId'=c.id::text
      AND LOWER(TRIM(i.status))!='draft' AND NOT c.invoice_paypal_fees`;
  if (!rows.length) return null;
  const row = rows[0];
  return { id: Number(row.id), clientId: Number(row.client_id), invoiceNumber: String(row.invoice_number),
    billCoverage: String(row.bill_coverage), amount: String(row.amount), invoiceDueDate: String(row.invoice_due_date),
    status: String(row.status), invoiceLink: String(row.invoice_link || ''),
    invoiceLayout: row.invoice_layout === 'itemized' ? 'itemized' : 'legacy',
    lineItems: Array.isArray(row.line_items) ? row.line_items as InvoiceLineItem[] : [],
    paymentLink: row.invoice_layout === 'itemized' ? String(row.payment_link || '') : DEFAULT_INVOICE_PAYMENT_LINK,
    billToName: String(row.bill_to_name || row.display_name || ''), billToCompany: String(row.bill_to_company || row.company_name || '') };
}
