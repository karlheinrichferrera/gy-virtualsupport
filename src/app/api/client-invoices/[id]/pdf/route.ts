import { clientInvoiceDownload } from "@/lib/client-invoice-download";
import { clientInvoicePdf } from "@/lib/client-invoice-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
  if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id))) return new Response("Invoice not found.", { status: 404, headers });
  try {
    const result = await clientInvoiceDownload(Number(id));
    if ("status" in result) return new Response(result.status === 401 ? "Please sign in again to download your invoice." : "Invoice not found.", { status: result.status, headers });
    const bytes = await clientInvoicePdf(result.invoice);
    const name = (result.invoice.invoiceNumber.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 100) || String(result.invoice.id)) + ".pdf";
    return new Response(new Uint8Array(bytes), { headers: { ...headers, "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${name}"` } });
  } catch {
    return new Response("The invoice PDF could not be generated. Please try again.", { status: 500, headers });
  }
}
