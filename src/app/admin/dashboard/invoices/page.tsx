"use client";

import { useState } from "react";
import { getAllInvoices } from "@/lib/data";
import StatusBadge from "@/components/StatusBadge";
import { FileText, Check, X } from "lucide-react";

export default function AdminInvoicesPage() {
  const [allInvoices, setAllInvoices] = useState(getAllInvoices());
  const [filterStatus, setFilterStatus] = useState<string>("All");

  function updateInvoiceStatus(invoiceNumber: string, status: "Paid" | "Pending" | "Draft") {
    setAllInvoices((prev) =>
      prev.map((item) =>
        item.invoice.invoiceNumber === invoiceNumber
          ? { ...item, invoice: { ...item.invoice, status } }
          : item
      )
    );
  }

  const filtered = filterStatus === "All"
    ? allInvoices
    : allInvoices.filter((i) => i.invoice.status === filterStatus);

  const totalAmount = allInvoices.reduce(
    (sum, i) => sum + parseFloat(i.invoice.amount.replace("$", "") || "0"), 0
  );
  const totalDisbursed = allInvoices
    .filter((i) => i.invoice.status === "Paid")
    .reduce((sum, i) => sum + parseFloat(i.invoice.amountDisbursed.replace("$", "") || "0"), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Invoice Management</h1>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-sm text-muted">Total Invoices</p>
          <p className="text-2xl font-bold text-foreground">{allInvoices.length}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-sm text-emerald-600">Paid</p>
          <p className="text-2xl font-bold text-emerald-600">
            {allInvoices.filter((i) => i.invoice.status === "Paid").length}
          </p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-sm text-amber-600">Pending</p>
          <p className="text-2xl font-bold text-amber-600">
            {allInvoices.filter((i) => i.invoice.status === "Pending").length}
          </p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-sm text-muted">Total Disbursed</p>
          <p className="text-2xl font-bold text-foreground">${totalDisbursed.toFixed(2)}</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {["All", "Paid", "Pending", "Draft"].map((status) => (
          <button
            key={status}
            onClick={() => setFilterStatus(status)}
            className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
              filterStatus === status
                ? "bg-indigo-600 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {status}
          </button>
        ))}
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-border">
                <th className="text-left px-6 py-3 font-semibold text-slate-600">Invoice #</th>
                <th className="text-left px-6 py-3 font-semibold text-slate-600">VA</th>
                <th className="text-left px-6 py-3 font-semibold text-slate-600">Date Covered</th>
                <th className="text-right px-6 py-3 font-semibold text-slate-600">Amount</th>
                <th className="text-right px-6 py-3 font-semibold text-slate-600">Fee</th>
                <th className="text-right px-6 py-3 font-semibold text-slate-600">Disbursed</th>
                <th className="text-center px-6 py-3 font-semibold text-slate-600">Status</th>
                <th className="text-center px-6 py-3 font-semibold text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.invoice.invoiceNumber} className="border-b border-border hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 font-mono font-medium text-foreground">
                    {item.invoice.invoiceNumber}
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-medium text-foreground">{item.vaName}</p>
                    <p className="text-xs text-muted">ID: {item.vaId}</p>
                  </td>
                  <td className="px-6 py-4 text-foreground">{item.invoice.dateCovered}</td>
                  <td className="px-6 py-4 text-right font-medium text-foreground">{item.invoice.amount}</td>
                  <td className="px-6 py-4 text-right text-muted">{item.invoice.transactionFee || "—"}</td>
                  <td className="px-6 py-4 text-right font-medium text-foreground">{item.invoice.amountDisbursed}</td>
                  <td className="px-6 py-4 text-center">
                    <StatusBadge status={item.invoice.status} />
                  </td>
                  <td className="px-6 py-4 text-center">
                    {item.invoice.status === "Pending" ? (
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => updateInvoiceStatus(item.invoice.invoiceNumber, "Paid")}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors"
                        >
                          <Check size={14} />
                          Mark Paid
                        </button>
                      </div>
                    ) : item.invoice.status === "Paid" ? (
                      <button
                        onClick={() => updateInvoiceStatus(item.invoice.invoiceNumber, "Pending")}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 rounded-lg hover:bg-amber-100 transition-colors"
                      >
                        <X size={14} />
                        Revert
                      </button>
                    ) : (
                      <span className="text-xs text-muted">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
