"use client";

import { useState, useEffect } from "react";
import * as actions from "@/lib/actions";
import type { Invoice } from "@/lib/data";
import StatusBadge from "@/components/StatusBadge";
import { FileText, Check, X, Trash2, AlertTriangle, Eye, Download, Pencil, Save, Search, Filter } from "lucide-react";

function downloadInvoice(inv: Invoice, vaName: string, vaId: string) {
  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Invoice ${inv.invoiceNumber}</title>
<style>
body{font-family:Arial,sans-serif;max-width:700px;margin:40px auto;padding:20px;color:#1e293b}
h1{color:#1e40af;margin-bottom:4px}
.header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #1e40af;padding-bottom:16px;margin-bottom:24px}
.info-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px}
.info-box{background:#f8fafc;padding:12px;border-radius:8px}
.label{font-size:12px;color:#64748b;text-transform:uppercase;margin-bottom:4px}
.value{font-weight:600;font-size:14px}
table{width:100%;border-collapse:collapse;margin-bottom:24px}
th{background:#f1f5f9;text-align:left;padding:10px 12px;font-size:13px;color:#475569;border-bottom:2px solid #e2e8f0}
td{padding:10px 12px;border-bottom:1px solid #e2e8f0;font-size:14px}
.total-row td{font-weight:700;font-size:16px;border-top:2px solid #1e40af;color:#059669}
.status{display:inline-block;padding:4px 12px;border-radius:12px;font-size:12px;font-weight:600;background:${inv.status==="Paid"?"#dcfce7;color:#166534":"#fef3c7;color:#92400e"}}
@media print{body{margin:0;padding:20px}}
</style></head><body>
<div class="header"><div><h1>INVOICE</h1><p style="color:#64748b;margin:0">${inv.invoiceNumber}</p></div><div style="text-align:right"><p style="font-weight:700;margin:0">Golden Years Design Benefits</p><p style="color:#64748b;margin:4px 0 0">Virtual Support Services</p></div></div>
<div class="info-grid"><div class="info-box"><div class="label">Bill To</div><div class="value">Devin Rubin</div><div style="font-size:13px;color:#64748b">Golden Years Design Benefits</div></div><div class="info-box"><div class="label">From</div><div class="value">${vaName}</div><div style="font-size:13px;color:#64748b">VA ID: ${vaId}</div></div><div class="info-box"><div class="label">Date Covered</div><div class="value">${inv.dateCovered}</div></div><div class="info-box"><div class="label">Status</div><div><span class="status">${inv.status}</span></div></div></div>
<table><thead><tr><th>Description</th><th style="text-align:right">Amount</th></tr></thead><tbody><tr><td>Service Fee</td><td style="text-align:right">${inv.amount}</td></tr>${inv.transactionFee?`<tr><td>Transaction Fee</td><td style="text-align:right;color:#dc2626">-${inv.transactionFee}</td></tr>`:""}<tr class="total-row"><td>Amount Disbursed</td><td style="text-align:right">${inv.amountDisbursed}</td></tr></tbody></table>
<p style="text-align:center;color:#94a3b8;font-size:12px;margin-top:40px">Generated from GY Virtual Support Portal</p>
</body></html>`;
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Invoice-${inv.invoiceNumber}.html`;
  a.click();
  URL.revokeObjectURL(url);
}

function escapeCsv(val: string): string {
  if (val.includes(",") || val.includes('"') || val.includes("\n")) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

function downloadAllInvoices(items: { vaId: string; vaName: string; invoice: Invoice }[]) {
  const headers = ["Invoice #", "VA Name", "VA ID", "Date Covered", "Amount", "Transaction Fee", "Amount Disbursed", "Status"];
  const rows = items.map((item) => [
    item.invoice.invoiceNumber,
    item.vaName,
    item.vaId,
    item.invoice.dateCovered,
    item.invoice.amount,
    item.invoice.transactionFee || "",
    item.invoice.amountDisbursed,
    item.invoice.status,
  ].map(escapeCsv).join(","));

  const totalAmount = items.reduce((s, i) => s + parseFloat(i.invoice.amount.replace("$", "") || "0"), 0);
  const totalFee = items.reduce((s, i) => s + parseFloat(i.invoice.transactionFee.replace("$", "") || "0"), 0);
  const totalDisbursed = items.reduce((s, i) => s + parseFloat(i.invoice.amountDisbursed.replace("$", "") || "0"), 0);
  const totalRow = ["TOTAL", "", "", "", `$${totalAmount.toFixed(2)}`, `$${totalFee.toFixed(2)}`, `$${totalDisbursed.toFixed(2)}`, ""].map(escapeCsv).join(",");

  const csv = [headers.join(","), ...rows, "", totalRow].join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Invoice-Report-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AdminInvoicesPage() {
  const [allInvoices, setAllInvoices] = useState<{ vaId: string; vaName: string; invoice: Invoice }[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>("All");
  const [filterVA, setFilterVA] = useState<string>("All");
  const [searchDate, setSearchDate] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState<{ vaId: string; vaName: string; invoice: Invoice } | null>(null);
  const [editTarget, setEditTarget] = useState<{ vaId: string; vaName: string; invoice: Invoice } | null>(null);
  const [editForm, setEditForm] = useState({ dateCovered: "", amount: "", transactionFee: "", amountDisbursed: "", status: "" as Invoice["status"] });

  useEffect(() => {
    (async () => {
      setAllInvoices(await actions.getAllInvoicesFlat());
    })();
  }, []);

  async function updateInvoiceStatus(invoiceNumber: string, status: "Paid" | "Pending" | "Draft") {
    await actions.updateInvoiceStatus(invoiceNumber, status);
    setAllInvoices(await actions.getAllInvoicesFlat());
  }

  async function handleDelete(invoiceNumber: string) {
    await actions.deleteInvoice(invoiceNumber);
    setAllInvoices(await actions.getAllInvoicesFlat());
    setDeleteTarget(null);
  }

  function openEdit(item: { vaId: string; vaName: string; invoice: Invoice }) {
    setEditTarget(item);
    setEditForm({
      dateCovered: item.invoice.dateCovered,
      amount: item.invoice.amount,
      transactionFee: item.invoice.transactionFee,
      amountDisbursed: item.invoice.amountDisbursed,
      status: item.invoice.status,
    });
  }

  async function handleEditSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editTarget) return;
    await actions.updateInvoice(editTarget.invoice.invoiceNumber, {
      dateCovered: editForm.dateCovered,
      amount: editForm.amount,
      transactionFee: editForm.transactionFee,
      amountDisbursed: editForm.amountDisbursed,
      status: editForm.status,
    });
    setAllInvoices(await actions.getAllInvoicesFlat());
    setEditTarget(null);
  }

  const vaOptions = Array.from(new Set(allInvoices.map((i) => i.vaId))).map((vaId) => {
    const match = allInvoices.find((i) => i.vaId === vaId);
    return { vaId, vaName: match?.vaName || vaId };
  });

  const filtered = allInvoices.filter((i) => {
    if (filterStatus !== "All" && i.invoice.status !== filterStatus) return false;
    if (filterVA !== "All" && i.vaId !== filterVA) return false;
    if (searchDate && !i.invoice.dateCovered.toLowerCase().includes(searchDate.toLowerCase())) return false;
    return true;
  });

  const totalDisbursed = allInvoices
    .filter((i) => i.invoice.status === "Paid")
    .reduce((sum, i) => sum + parseFloat(i.invoice.amountDisbursed.replace("$", "") || "0"), 0);

  const inputClass = "w-full px-4 py-2.5 rounded-lg border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Invoice Management</h1>
        <button
          onClick={() => downloadAllInvoices(filtered)}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
        >
          <Download size={16} /> Download {filterStatus !== "All" || filterVA !== "All" || searchDate ? "Filtered" : "All"} ({filtered.length})
        </button>
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

      <div className="flex flex-wrap items-center gap-3">
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
        <div className="flex items-center gap-2">
          <Filter size={16} className="text-muted" />
          <select
            value={filterVA}
            onChange={(e) => setFilterVA(e.target.value)}
            className="px-3 py-1.5 text-sm rounded-lg border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="All">All VAs</option>
            {vaOptions.map((va) => (
              <option key={va.vaId} value={va.vaId}>{va.vaName} ({va.vaId})</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <Search size={16} className="text-muted" />
          <input
            type="text"
            value={searchDate}
            onChange={(e) => setSearchDate(e.target.value)}
            placeholder="Search by date (e.g. July, August 2026)"
            className="px-3 py-1.5 text-sm rounded-lg border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-72"
          />
          {(filterVA !== "All" || searchDate || filterStatus !== "All") && (
            <button
              onClick={() => { setFilterVA("All"); setSearchDate(""); setFilterStatus("All"); }}
              className="px-3 py-1.5 text-sm rounded-lg text-red-600 bg-red-50 hover:bg-red-100 font-medium transition-colors"
            >
              Clear Filters
            </button>
          )}
        </div>
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
              {filtered.length === 0 ? (
                <tr><td colSpan={8} className="px-6 py-8 text-center text-muted">No invoices match the current filters.</td></tr>
              ) : (
                filtered.map((item) => (
                  <tr key={item.invoice.invoiceNumber} className="border-b border-border hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 font-mono font-medium text-foreground">{item.invoice.invoiceNumber}</td>
                    <td className="px-6 py-4">
                      <p className="font-medium text-foreground">{item.vaName}</p>
                      <p className="text-xs text-muted">ID: {item.vaId}</p>
                    </td>
                    <td className="px-6 py-4 text-foreground">{item.invoice.dateCovered}</td>
                    <td className="px-6 py-4 text-right font-medium text-foreground">{item.invoice.amount}</td>
                    <td className="px-6 py-4 text-right text-muted">{item.invoice.transactionFee || "—"}</td>
                    <td className="px-6 py-4 text-right font-medium text-foreground">{item.invoice.amountDisbursed}</td>
                    <td className="px-6 py-4 text-center"><StatusBadge status={item.invoice.status} /></td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => setShowPreview(item)}
                          className="p-1.5 rounded hover:bg-slate-100 text-slate-500 hover:text-blue-600 transition-colors"
                          title="View"
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          onClick={() => openEdit(item)}
                          className="p-1.5 rounded hover:bg-slate-100 text-slate-500 hover:text-amber-600 transition-colors"
                          title="Edit"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          onClick={() => downloadInvoice(item.invoice, item.vaName, item.vaId)}
                          className="p-1.5 rounded hover:bg-slate-100 text-slate-500 hover:text-emerald-600 transition-colors"
                          title="Download"
                        >
                          <Download size={16} />
                        </button>
                        {item.invoice.status === "Pending" && (
                          <button
                            onClick={() => updateInvoiceStatus(item.invoice.invoiceNumber, "Paid")}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-emerald-700 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors"
                            title="Mark Paid"
                          >
                            <Check size={14} />
                          </button>
                        )}
                        {item.invoice.status === "Paid" && (
                          <button
                            onClick={() => updateInvoiceStatus(item.invoice.invoiceNumber, "Pending")}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-amber-700 bg-amber-50 rounded-lg hover:bg-amber-100 transition-colors"
                            title="Revert to Pending"
                          >
                            <X size={14} />
                          </button>
                        )}
                        <button
                          onClick={() => setDeleteTarget(item.invoice.invoiceNumber)}
                          className="p-1.5 rounded hover:bg-slate-100 text-slate-500 hover:text-red-600 transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showPreview && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-900">Invoice Preview</h2>
              <button onClick={() => setShowPreview(null)} className="p-1 hover:bg-slate-100 rounded-lg">
                <X size={20} className="text-slate-500" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500 uppercase">Invoice</p>
                  <p className="text-lg font-bold text-slate-900">{showPreview.invoice.invoiceNumber}</p>
                </div>
                <StatusBadge status={showPreview.invoice.status} />
              </div>
              <div className="bg-slate-50 rounded-lg p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Bill To</span>
                  <span className="font-medium text-slate-900">Devin Rubin</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Company</span>
                  <span className="font-medium text-slate-900">Golden Years Design Benefits</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">From</span>
                  <span className="font-medium text-slate-900">{showPreview.vaName} ({showPreview.vaId})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Coverage</span>
                  <span className="font-medium text-slate-900">{showPreview.invoice.dateCovered}</span>
                </div>
              </div>
              <div className="border-t border-slate-200 pt-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Amount</span>
                  <span className="font-medium text-slate-900">{showPreview.invoice.amount}</span>
                </div>
                {showPreview.invoice.transactionFee && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Transaction Fee</span>
                    <span className="text-red-600">-{showPreview.invoice.transactionFee}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-slate-200 pt-2">
                  <span className="font-semibold text-slate-900">Amount Disbursed</span>
                  <span className="font-bold text-emerald-600 text-lg">{showPreview.invoice.amountDisbursed}</span>
                </div>
              </div>
              <button
                onClick={() => downloadInvoice(showPreview.invoice, showPreview.vaName, showPreview.vaId)}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <Download size={16} /> Download Invoice
              </button>
            </div>
          </div>
        </div>
      )}

      {editTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Pencil size={20} className="text-amber-600" /> Edit Invoice {editTarget.invoice.invoiceNumber}
              </h2>
              <button onClick={() => setEditTarget(null)} className="p-1 hover:bg-slate-100 rounded-lg">
                <X size={20} className="text-slate-500" />
              </button>
            </div>
            <form onSubmit={handleEditSave} className="p-6 space-y-4">
              <div className="bg-slate-50 rounded-lg p-3 text-sm">
                <p className="text-slate-600"><strong>VA:</strong> {editTarget.vaName} ({editTarget.vaId})</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Date Covered</label>
                <input type="text" value={editForm.dateCovered} onChange={(e) => setEditForm((f) => ({ ...f, dateCovered: e.target.value }))} className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Amount</label>
                <input type="text" value={editForm.amount} onChange={(e) => setEditForm((f) => ({ ...f, amount: e.target.value }))} className={inputClass} placeholder="$0.00" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Transaction Fee</label>
                <input type="text" value={editForm.transactionFee} onChange={(e) => setEditForm((f) => ({ ...f, transactionFee: e.target.value }))} className={inputClass} placeholder="$0.00" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Amount Disbursed</label>
                <input type="text" value={editForm.amountDisbursed} onChange={(e) => setEditForm((f) => ({ ...f, amountDisbursed: e.target.value }))} className={inputClass} placeholder="$0.00" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                <select value={editForm.status} onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value as Invoice["status"] }))} className={inputClass}>
                  <option value="Pending">Pending</option>
                  <option value="Paid">Paid</option>
                  <option value="Draft">Draft</option>
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setEditTarget(null)} className="flex-1 border border-slate-300 text-slate-700 font-medium py-2.5 rounded-lg hover:bg-slate-50 transition-colors">Cancel</button>
                <button type="submit" className="flex-1 bg-amber-600 hover:bg-amber-700 text-white font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2">
                  <Save size={16} /> Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
                <button onClick={() => setDeleteTarget(null)} className="flex-1 border border-slate-300 text-slate-700 font-medium py-2.5 rounded-lg hover:bg-slate-50 transition-colors text-sm">Cancel</button>
                <button onClick={() => handleDelete(deleteTarget)} className="flex-1 bg-red-600 hover:bg-red-700 text-white font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm">
                  <Trash2 size={16} /> Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
