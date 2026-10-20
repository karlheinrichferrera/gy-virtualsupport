import type { ClientAccount, ClientInvoice } from "@/lib/actions";
import { invoiceAmountCents, invoiceMoney, invoicePaymentLink, INVOICE_SUPPORT_EMAIL } from "@/lib/client-invoice-format";

export default function ItemizedClientInvoice({ invoice, client }: { invoice: ClientInvoice; client?: Pick<ClientAccount, "displayName" | "companyName"> | null }) {
  let paymentLink = "";
  try { paymentLink = invoicePaymentLink(invoice.paymentLink || ""); } catch { /* Omit unsafe stored links. */ }
  const paid = invoice.status.trim().toLowerCase() === "paid";
  return <article aria-label="Invoice document" className="overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-sm [overflow-wrap:anywhere]">
    <div className="h-1.5 bg-[#142d42]" />
    <div className="p-5 sm:p-10">
      <header className="flex flex-wrap items-start justify-between gap-6 border-b border-slate-200 pb-7">
        <div className="flex items-center gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#142d42] text-lg font-semibold tracking-tight text-white">GY</span><div><p className="text-sm font-semibold tracking-wide">GY Virtual Support</p><p className="mt-1 text-xs text-slate-500">Client services · Billing</p></div></div>
        <div className="sm:text-right"><h2 className="text-3xl font-light tracking-tight sm:text-4xl">INVOICE</h2><p className="mt-2 text-xs font-medium text-slate-500">{invoice.invoiceNumber}</p></div>
      </header>
      <section className="grid gap-7 py-7 sm:grid-cols-2">
        <div><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Bill to</p><p className="mt-3 text-lg font-semibold">{invoice.billToName || client?.displayName || "—"}</p><p className="mt-1 text-sm text-slate-500">{invoice.billToCompany || client?.companyName || "—"}</p></div>
        <dl className="space-y-3 text-xs sm:text-sm"><div className="flex justify-between gap-4"><dt className="text-slate-500">Billing Period</dt><dd className="text-right font-medium">{invoice.billCoverage}</dd></div><div className="flex justify-between gap-4"><dt className="text-slate-500">Payment Due Date</dt><dd className="text-right font-medium">{invoice.invoiceDueDate}</dd></div><div className="flex items-center justify-between gap-4"><dt className="text-slate-500">Status</dt><dd className={`rounded-full px-2.5 py-1 text-xs font-medium ${paid ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{invoice.status}</dd></div></dl>
      </section>
      <table className="w-full table-fixed text-xs sm:text-sm">
        <colgroup><col className="w-[72%]" /><col className="w-[28%]" /></colgroup>
        <thead><tr className="border-y border-slate-200 bg-slate-50 text-[10px] uppercase tracking-widest text-slate-500"><th scope="col" className="py-3 pl-3 text-left font-semibold">Description</th><th scope="col" className="py-3 pr-3 text-right font-semibold">Amount</th></tr></thead>
        <tbody>{invoice.lineItems?.map((item, index) => <tr key={index} className="border-b border-slate-100">
          <td className="py-5 pr-4 align-top"><p className="whitespace-pre-wrap font-semibold leading-relaxed">{item.title}</p>{item.description && <p className="mt-2 whitespace-pre-wrap leading-relaxed text-slate-500">{item.description}</p>}</td>
          <td className="py-5 text-right align-top font-medium tabular-nums">{invoiceMoney(invoiceAmountCents(item.amount))}</td>
        </tr>)}</tbody>
      </table>
      <div className="mt-6 flex justify-end"><div className="w-full rounded-xl bg-slate-50 p-5 sm:max-w-xs"><div className="flex justify-between gap-4 text-xs text-slate-500"><span>Subtotal</span><span className="tabular-nums">{invoice.amount}</span></div><div className="mt-4 flex flex-wrap items-baseline justify-between gap-3 border-t border-slate-200 pt-4"><span className="text-[10px] font-semibold uppercase tracking-widest">GRAND TOTAL</span><span className="text-2xl font-semibold tracking-tight tabular-nums">{invoice.amount}</span></div><p className="mt-2 text-right text-[10px] uppercase tracking-wider text-slate-500">USD · {paid ? "Payment received" : "Amount due"}</p></div></div>
      <footer className="mt-8 space-y-4 border-t border-slate-200 pt-6 text-xs leading-relaxed text-slate-500">
        {paid ? <p className="font-medium text-emerald-700">Thank you for your payment.</p> : paymentLink && <div><a className="inline-flex rounded-lg bg-[#142d42] px-5 py-3 text-sm font-medium text-white" href={paymentLink} target="_blank" rel="noopener noreferrer">Pay invoice</a><p className="mt-3">Payment link: <a className="underline underline-offset-2" href={paymentLink} target="_blank" rel="noopener noreferrer">{paymentLink}</a></p></div>}
        <p>Questions about this invoice? <a className="font-medium text-slate-700 underline underline-offset-2" href={`mailto:${INVOICE_SUPPORT_EMAIL}`}>{INVOICE_SUPPORT_EMAIL}</a></p>
        {!paid && <p>Please pay before the scheduled due date to avoid interruption of VA workloads.</p>}
        <p className="font-medium text-slate-700">Thank you for your business!</p>
      </footer>
    </div>
  </article>;
}
