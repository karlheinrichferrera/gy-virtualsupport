"use client";

import { useState, useEffect } from "react";
import * as store from "@/lib/store";
import type { Invoice } from "@/lib/data";
import StatusBadge from "@/components/StatusBadge";
import { FileText, Check, X, Trash2, AlertTriangle } from "lucide-react";

export default function AdminInvoicesPage() {
  const [allInvoices, setAllInvoices] = useState<{ vaId: string; vaName: string; invoice: Invoice }[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>("All");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  useEffect(() => {
    setAllInvoices(store.getAllInvoicesFlat());
  }, []);

  function updateInvoiceStatus(invoiceNumber: string, status: "Paid" | "Pending" | "Draft") {
    store.updateInvoiceStatus(invoiceNumber, status);
    setAllInvoices(store.getAllInvoicesFlat());
  }

  function handleDelete(invoiceNumber: string) {
    store.deleteInvoice(invoiceNumber);
    setAllInvoices(store.getAllInvoicesFlat());
    setDeleteTarget(null);
  }

  const filtered = filterStatus === "All"
    ? allInvoices
    : allInvoices.filter((i) => i.invoice.status === filterStatus);

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
                    <div className="flex items-center justify-center gap-2">
                      {item.invoice.status === "Pending" && (
                        <button
                          onClick={() => updateInvoiceStatus(item.invoice.invoiceNumber, "Paid")}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors"
                        >
                          <Check size={14} />
                          Mark Paid
                        </button>
                      )}
                      {item.invoice.status === "Paid" && (
                        <button
                          onClick={() => updateInvoiceStatus(item.invoice.invoiceNumber, "Pending")}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 rounded-lg hover:bg-amber-100 transition-colors"
                        >
                          <X size={14} />
                          Revert
                        </button>
                      )}
                      <button
                        onClick={() => setDeleteTarget(item.invoice.invoiceNumber)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="p-6 text-center space-y-4">
              <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto">
                <AlertTriangle className="text-red-600" size={28} />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Delete Invoice</h3>
              <p className="text-sm text-slate-600">
                Are you sure you want to delete invoice <strong>{deleteTarget}</strong>? This action cannot be undone.
              </p>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setDeleteTarget(null)} className="flex-1 border border-slate-300 text-slate-700 font-medium py-2.5 rounded-lg hover:bg-slate-50 transition-colors text-sm">
                  Cancel
                </button>
                <button
                  onClick={() => handleDelete(deleteTarget)}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm"
                >
                  <Trash2 size={16} />
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
