"use client";

import { useEffect, useState } from "react";
import * as actions from "@/lib/actions";
import type { Invoice, VAProfile } from "@/lib/data";
import StatusBadge from "@/components/StatusBadge";
import { Plus, Send, FileText, Download, X, Eye, Pencil, Save } from "lucide-react";

function downloadInvoice(inv: Invoice, profile: VAProfile | null) {
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
<div class="info-grid"><div class="info-box"><div class="label">Bill To</div><div class="value">Devin Rubin</div><div style="font-size:13px;color:#64748b">Golden Years Design Benefits</div></div><div class="info-box"><div class="label">From</div><div class="value">${profile?.firstName || ""} ${profile?.lastName || ""}</div><div style="font-size:13px;color:#64748b">VA ID: ${profile?.id || ""}</div></div><div class="info-box"><div class="label">Date Covered</div><div class="value">${inv.dateCovered}</div></div><div class="info-box"><div class="label">Status</div><div><span class="status">${inv.status}</span></div></div></div>
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

export default function InvoicesPage() {
  const [invoiceList, setInvoiceList] = useState<Invoice[]>([]);
  const [profile, setProfile] = useState<VAProfile | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showPreview, setShowPreview] = useState<Invoice | null>(null);
  const [editTarget, setEditTarget] = useState<Invoice | null>(null);
  const [editForm, setEditForm] = useState({ dateCovered: "", amount: "", transactionFee: "", amountDisbursed: "" });
  const [form, setForm] = useState({
    dateFrom: "",
    dateTo: "",
    hours: "",
    rate: "5.00",
    bonusDescription: "",
    bonusAmount: "",
  });
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    (async () => {
      const id = localStorage.getItem("vaId") || "";
      setInvoiceList(await actions.getInvoicesFor(id));
      setProfile((await actions.getProfile(id)) || null);
    })();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const id = localStorage.getItem("vaId") || "";
    const hours = parseFloat(form.hours) || 0;
    const rate = parseFloat(form.rate) || 0;
    const bonus = parseFloat(form.bonusAmount) || 0;
    const amount = hours * rate + bonus;
    const fee = amount * 0.01;

    const invoiceNumber = await actions.generateNextInvoiceNumber(id);
    const newInvoice: Invoice = {
      invoiceNumber,
      dateCovered: `${form.dateFrom} - ${form.dateTo}`,
      amount: `$${amount.toFixed(2)}`,
      transactionFee: `$${fee.toFixed(2)}`,
      amountDisbursed: `$${(amount - fee).toFixed(2)}`,
      invoiceCopy: "",
      status: "Pending",
    };
    await actions.addInvoice(id, newInvoice);
    const updated = await actions.getInvoicesFor(id);
    setInvoiceList(updated);
    setSubmitted(true);
  }

  function openEdit(inv: Invoice) {
    setEditTarget(inv);
    setEditForm({
      dateCovered: inv.dateCovered,
      amount: inv.amount,
      transactionFee: inv.transactionFee,
      amountDisbursed: inv.amountDisbursed,
    });
  }

  async function handleEditSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editTarget) return;
    await actions.updateInvoice(editTarget.invoiceNumber, {
      dateCovered: editForm.dateCovered,
      amount: editForm.amount,
      transactionFee: editForm.transactionFee,
      amountDisbursed: editForm.amountDisbursed,
    });
    const id = localStorage.getItem("vaId") || "";
    const updated = await actions.getInvoicesFor(id);
    setInvoiceList(updated);
    setEditTarget(null);
  }

  const inputClass =
    "w-full px-4 py-2.5 rounded-lg border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Invoices</h1>
        <button
          onClick={() => {
            setShowCreate(true);
            setSubmitted(false);
            setForm({
              dateFrom: "",
              dateTo: "",
              hours: "",
              rate: "5.00",
              bonusDescription: "",
              bonusAmount: "",
            });
          }}
          className="bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
        >
          <Plus size={16} />
          Create Invoice
        </button>
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-border">
                <th className="text-left px-6 py-3 font-semibold text-slate-600">Invoice #</th>
                <th className="text-left px-6 py-3 font-semibold text-slate-600">Date Covered</th>
                <th className="text-right px-6 py-3 font-semibold text-slate-600">Amount</th>
                <th className="text-right px-6 py-3 font-semibold text-slate-600">Fee</th>
                <th className="text-right px-6 py-3 font-semibold text-slate-600">Disbursed</th>
                <th className="text-center px-6 py-3 font-semibold text-slate-600">Status</th>
                <th className="text-center px-6 py-3 font-semibold text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {invoiceList.map((inv) => (
                <tr
                  key={inv.invoiceNumber}
                  className="border-b border-border hover:bg-slate-50/50 transition-colors"
                >
                  <td className="px-6 py-4 font-medium text-foreground">{inv.invoiceNumber}</td>
                  <td className="px-6 py-4 text-foreground">{inv.dateCovered || "—"}</td>
                  <td className="px-6 py-4 text-right font-medium text-foreground">{inv.amount || "—"}</td>
                  <td className="px-6 py-4 text-right text-muted">{inv.transactionFee || "—"}</td>
                  <td className="px-6 py-4 text-right font-semibold text-emerald-600">{inv.amountDisbursed}</td>
                  <td className="px-6 py-4 text-center"><StatusBadge status={inv.status} /></td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center gap-1">
                      {inv.status && (
                        <button
                          onClick={() => setShowPreview(inv)}
                          className="p-1.5 rounded hover:bg-slate-100 text-slate-500 hover:text-blue-600 transition-colors"
                          title="View"
                        >
                          <Eye size={16} />
                        </button>
                      )}
                      {inv.status === "Pending" && (
                        <button
                          onClick={() => openEdit(inv)}
                          className="p-1.5 rounded hover:bg-slate-100 text-slate-500 hover:text-amber-600 transition-colors"
                          title="Edit"
                        >
                          <Pencil size={16} />
                        </button>
                      )}
                      {inv.status && inv.invoiceNumber && (
                        <button
                          onClick={() => downloadInvoice(inv, profile)}
                          className="p-1.5 rounded hover:bg-slate-100 text-slate-500 hover:text-emerald-600 transition-colors"
                          title="Download"
                        >
                          <Download size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
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
                  <p className="text-lg font-bold text-slate-900">{showPreview.invoiceNumber}</p>
                </div>
                <StatusBadge status={showPreview.status} />
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
                  <span className="font-medium text-slate-900">{profile?.firstName} {profile?.lastName} ({profile?.id})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Coverage</span>
                  <span className="font-medium text-slate-900">{showPreview.dateCovered}</span>
                </div>
              </div>
              <div className="border-t border-slate-200 pt-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Amount</span>
                  <span className="font-medium text-slate-900">{showPreview.amount}</span>
                </div>
                {showPreview.transactionFee && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Transaction Fee</span>
                    <span className="text-red-600">-{showPreview.transactionFee}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-slate-200 pt-2">
                  <span className="font-semibold text-slate-900">Amount Disbursed</span>
                  <span className="font-bold text-emerald-600 text-lg">{showPreview.amountDisbursed}</span>
                </div>
              </div>
              <button
                onClick={() => { downloadInvoice(showPreview, profile); }}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2"
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
                <Pencil size={20} className="text-amber-600" /> Edit Invoice {editTarget.invoiceNumber}
              </h2>
              <button onClick={() => setEditTarget(null)} className="p-1 hover:bg-slate-100 rounded-lg">
                <X size={20} className="text-slate-500" />
              </button>
            </div>
            <form onSubmit={handleEditSave} className="p-6 space-y-4">
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

      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <FileText size={20} className="text-blue-600" />
                {submitted ? "Invoice Created" : "Create New Invoice"}
              </h2>
              <button onClick={() => setShowCreate(false)} className="p-1 hover:bg-slate-100 rounded-lg">
                <X size={20} className="text-slate-500" />
              </button>
            </div>

            {submitted ? (
              <div className="p-6 text-center space-y-4">
                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
                  <Send className="text-emerald-600" size={28} />
                </div>
                <h3 className="text-lg font-semibold text-slate-900">Invoice Sent Successfully!</h3>
                <p className="text-sm text-slate-600">
                  Your invoice has been created and sent for review. You can track its status on the invoices page.
                </p>
                <button onClick={() => setShowCreate(false)} className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-lg transition-colors">
                  Close
                </button>
              </div>
            ) : (
              <form onSubmit={handleCreate} className="p-6 space-y-4">
                <div className="bg-slate-50 rounded-lg p-3 text-sm">
                  <p className="text-slate-600"><strong>Bill To:</strong> Devin Rubin</p>
                  <p className="text-slate-600"><strong>Company:</strong> Golden Years Design Benefits</p>
                  <p className="text-slate-600"><strong>From:</strong> {profile?.firstName} {profile?.lastName} ({profile?.id})</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Date From</label>
                    <input type="date" value={form.dateFrom} onChange={(e) => setForm((f) => ({ ...f, dateFrom: e.target.value }))} required className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Date To</label>
                    <input type="date" value={form.dateTo} onChange={(e) => setForm((f) => ({ ...f, dateTo: e.target.value }))} required className={inputClass} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Hours Worked</label>
                    <input type="number" value={form.hours} onChange={(e) => setForm((f) => ({ ...f, hours: e.target.value }))} required min="0" step="0.5" className={inputClass} placeholder="80" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Rate (USD/hr)</label>
                    <input type="number" value={form.rate} onChange={(e) => setForm((f) => ({ ...f, rate: e.target.value }))} required min="0" step="0.01" className={inputClass} />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Bonus Description (optional)</label>
                  <input type="text" value={form.bonusDescription} onChange={(e) => setForm((f) => ({ ...f, bonusDescription: e.target.value }))} className={inputClass} placeholder="e.g. T65 Appointment Setting bonuses" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Bonus Amount (optional)</label>
                  <input type="number" value={form.bonusAmount} onChange={(e) => setForm((f) => ({ ...f, bonusAmount: e.target.value }))} min="0" step="0.01" className={inputClass} placeholder="0.00" />
                </div>

                <div className="bg-blue-50 rounded-lg p-4 text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Hourly ({form.hours || 0}h x ${form.rate}/hr)</span>
                    <span className="font-medium text-slate-900">${((parseFloat(form.hours) || 0) * (parseFloat(form.rate) || 0)).toFixed(2)}</span>
                  </div>
                  {form.bonusAmount && parseFloat(form.bonusAmount) > 0 && (
                    <div className="flex justify-between">
                      <span className="text-slate-600">Bonus</span>
                      <span className="font-medium text-slate-900">${parseFloat(form.bonusAmount).toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-blue-200 pt-1 mt-1">
                    <span className="font-semibold text-blue-900">Total</span>
                    <span className="font-bold text-blue-900">${((parseFloat(form.hours) || 0) * (parseFloat(form.rate) || 0) + (parseFloat(form.bonusAmount) || 0)).toFixed(2)}</span>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowCreate(false)} className="flex-1 border border-slate-300 text-slate-700 font-medium py-2.5 rounded-lg hover:bg-slate-50 transition-colors">Cancel</button>
                  <button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2">
                    <Send size={16} /> Create & Send
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
