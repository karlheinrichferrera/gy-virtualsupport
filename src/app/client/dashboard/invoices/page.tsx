"use client";

import { useCallback, useEffect, useState } from "react";
import { FileText, Eye } from "lucide-react";
import * as actions from "@/lib/actions";
import type { ClientAccount, ClientInvoice } from "@/lib/actions";
import ClientInvoicePreview from "@/components/ClientInvoicePreview";

export default function ClientInvoicesPage() {
  const [invoices, setInvoices] = useState<ClientInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [client, setClient] = useState<ClientAccount | null>(null);
  const [previewInvoice, setPreviewInvoice] = useState<ClientInvoice | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const email = localStorage.getItem("clientEmail") || "";
      if (email) {
        const [items, account] = await Promise.all([
          actions.getClientInvoicesByEmail(email),
          actions.getClientAccountByEmail(email),
        ]);
        setInvoices(items);
        setClient(account);
      }
    } catch {
      setError("Invoices could not be loaded. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
        <FileText size={24} />
        Invoices
      </h1>

      {error ? (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
          {error}
          <button type="button" onClick={() => { void load(); }} className="ml-2 font-semibold underline">Try again</button>
        </div>
      ) : invoices.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-8 text-center">
          <FileText size={48} className="mx-auto text-slate-300 mb-4" />
          <h2 className="text-lg font-semibold text-slate-700 mb-2">No Invoices Yet</h2>
          <p className="text-slate-500">Your invoices will appear here once they are created.</p>
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-border">
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Invoice #</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Bill Coverage</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Amount</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Due Date</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Status</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Invoice</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} className="border-b border-border hover:bg-slate-50/50">
                    <td className="px-4 py-3 font-mono font-medium text-foreground">{inv.invoiceNumber}</td>
                    <td className="px-4 py-3 text-foreground">{inv.billCoverage}</td>
                    <td className="px-4 py-3 font-medium text-foreground">{inv.amount}</td>
                    <td className="px-4 py-3 text-foreground">{inv.invoiceDueDate}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        inv.status === "Paid" ? "bg-emerald-100 text-emerald-700" :
                        inv.status === "Pending" ? "bg-amber-100 text-amber-700" :
                        inv.status === "Overdue" ? "bg-red-100 text-red-700" :
                        "bg-slate-100 text-slate-600"
                      }`}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button type="button" onClick={() => setPreviewInvoice(inv)} aria-label={`View invoice ${inv.invoiceNumber}`} className="inline-flex min-h-10 items-center gap-1.5 whitespace-nowrap rounded-lg px-2 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 font-medium">
                        <Eye size={16} aria-hidden="true" /> View Invoice
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {previewInvoice && <ClientInvoicePreview invoice={previewInvoice} client={client} onClose={() => setPreviewInvoice(null)} />}
    </div>
  );
}
