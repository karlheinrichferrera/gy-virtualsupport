import { emailedClientInvoice } from "@/lib/client-invoice-email-link";
import { clientInvoicePdf } from "@/lib/client-invoice-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer", "X-Robots-Tag": "noindex, nofollow, noarchive" };
  try {
    const invoice = await emailedClientInvoice(token);
    if (!invoice) return new Response("Invoice not found or no longer available.", { status: 404, headers });
    const bytes = await clientInvoicePdf(invoice);
    const filename = (invoice.invoiceNumber.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 100) || String(invoice.id)) + ".pdf";
    return new Response(new Uint8Array(bytes), { headers: { ...headers, "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${filename}"` } });
  } catch {
    return new Response("The invoice PDF could not be opened. Please try again.", { status: 500, headers });
  }
}
