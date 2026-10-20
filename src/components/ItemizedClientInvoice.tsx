import type { ClientAccount, ClientInvoice } from "@/lib/actions";
import { invoiceAmountCents, invoiceMoney, invoicePaymentLink, INVOICE_SUPPORT_EMAIL } from "@/lib/client-invoice-format";

export default function ItemizedClientInvoice({ invoice, client }: { invoice: ClientInvoice; client?: Pick<ClientAccount, "displayName" | "companyName"> | null }) {
  let paymentLink = "";
  try { paymentLink = invoicePaymentLink(invoice.paymentLink || ""); } catch { /* Never render an unsafe URL from old data. */ }
  const cell = "border border-black px-3 py-2 [overflow-wrap:anywhere]";
  const paid = invoice.status.trim().toLowerCase() === "paid";
  return <article aria-label="Invoice document" className="overflow-hidden border border-black bg-white text-black">
    <div className="grid grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <div className={`${cell} flex items-center bg-black text-2xl font-extrabold text-white sm:text-4xl`}>INVOICE</div>
      <div className={`${cell} flex items-center justify-center text-lg font-extrabold sm:text-4xl`}>{invoice.amount}</div>
      {[["INVOICE NUMBER", invoice.invoiceNumber], ["BILL TO", invoice.billToName || client?.displayName || "—"], ["COMPANY", invoice.billToCompany || client?.companyName || "—"]].map(([label, value]) => <div key={label} className="contents">
        <div className={`${cell} bg-black text-xs font-bold text-white sm:text-sm`}>{label}</div><div className={`${cell} text-xs font-semibold sm:text-sm`}>{value}</div>
      </div>)}
    </div>
    <div className={`${cell} space-y-1 text-xs sm:text-sm`}><p><strong>Billing Period:</strong> {invoice.billCoverage}</p><p><strong>Payment Due Date:</strong> {invoice.invoiceDueDate}</p><p><strong>Status:</strong> {invoice.status}</p></div>
    <table className="w-full table-fixed border-collapse text-xs sm:text-sm">
      <colgroup><col className="w-3/5" /><col className="w-2/5" /></colgroup>
      <thead><tr className="bg-black text-white"><th scope="col" className={`${cell} text-left`}>Description</th><th scope="col" className={`${cell} text-center`}>TOTAL</th></tr></thead>
      <tbody>{invoice.lineItems?.map((item, index) => <tr key={index}>
        <td className={`${cell} py-4 align-top`}><p className="whitespace-pre-wrap font-bold">{item.title}</p>{item.description && <p className="mt-1 whitespace-pre-wrap">{item.description}</p>}</td>
        <td className={`${cell} text-center align-middle`}>{invoiceMoney(invoiceAmountCents(item.amount))}</td>
      </tr>)}<tr><td className={`${cell} font-semibold`}>**Nothing follows**</td><td className={cell} /></tr></tbody>
      <tfoot><tr className="bg-[#4b86e8]"><th scope="row" className={`${cell} text-right font-medium`}>TOTAL</th><td className={`${cell} text-center`}>{invoice.amount}</td></tr>
        <tr className="bg-[#204780] font-bold text-white"><th scope="row" className={`${cell} text-right`}>GRAND TOTAL</th><td className={`${cell} text-center`}>{invoice.amount}</td></tr></tfoot>
    </table>
    <footer className="space-y-3 px-3 py-5 text-xs leading-relaxed [overflow-wrap:anywhere] sm:text-sm">
      {paid ? <p className="font-semibold">Thank you for your payment.</p> : paymentLink && <p>To pay your invoice, kindly click the link below:<br /><a className="text-blue-700 underline" href={paymentLink} target="_blank" rel="noopener noreferrer">{paymentLink}</a></p>}
      <p>If you have any questions or concerns about this invoice, please email <a className="text-blue-700 underline" href={`mailto:${INVOICE_SUPPORT_EMAIL}`}>{INVOICE_SUPPORT_EMAIL}</a>.{!paid && <><br />Please pay before the scheduled due date to avoid interruption of VA workloads.</>}</p>
      <p>Thank you for your business!</p>
    </footer>
  </article>;
}
