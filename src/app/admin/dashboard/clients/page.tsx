"use client";

import { useState, useEffect } from "react";
import * as actions from "@/lib/actions";
import type { ClientAccount, ClientInvoice } from "@/lib/actions";
import { Building2, Plus, X, Trash2, AlertTriangle, KeyRound, FileText, Pencil, Save } from "lucide-react";

const inputClass = "w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900";

export default function AdminClientsPage() {
  const [clients, setClients] = useState<ClientAccount[]>([]);
  const [invoices, setInvoices] = useState<ClientInvoice[]>([]);
  const [showAddClient, setShowAddClient] = useState(false);
  const [showAddInvoice, setShowAddInvoice] = useState(false);
  const [deleteClientTarget, setDeleteClientTarget] = useState<number | null>(null);
  const [resetTarget, setResetTarget] = useState<number | null>(null);
  const [deleteInvTarget, setDeleteInvTarget] = useState<number | null>(null);
  const [editInv, setEditInv] = useState<ClientInvoice | null>(null);
  const [tab, setTab] = useState<"accounts" | "invoices">("accounts");

  const [clientForm, setClientForm] = useState({ email: "", password: "gyclient2026", displayName: "", companyName: "", address: "", phone: "" });
  const [editClient, setEditClient] = useState<ClientAccount | null>(null);
  const [editClientForm, setEditClientForm] = useState({ displayName: "", companyName: "", address: "", phone: "", email: "" });
  const [invForm, setInvForm] = useState({ clientId: 0, invoiceNumber: "", billCoverage: "", amount: "", invoiceDueDate: "", status: "Pending", invoiceLink: "" });
  const [editInvForm, setEditInvForm] = useState({ clientId: 0, invoiceNumber: "", billCoverage: "", amount: "", invoiceDueDate: "", status: "", invoiceLink: "" });
  const [error, setError] = useState("");

  async function loadData() {
    const [c, i] = await Promise.all([actions.getClientAccounts(), actions.getClientInvoices()]);
    setClients(c);
    setInvoices(i);
  }

  useEffect(() => { loadData(); }, []);

  async function handleAddClient(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const result = await actions.addClientAccount(clientForm.email, clientForm.password, clientForm.displayName, clientForm.companyName, clientForm.address, clientForm.phone);
    if (!result.success) { setError(result.error || "Failed"); return; }
    setShowAddClient(false);
    setClientForm({ email: "", password: "gyclient2026", displayName: "", companyName: "", address: "", phone: "" });
    await loadData();
  }

  async function handleDeleteClient() {
    if (deleteClientTarget === null) return;
    await actions.deleteClientAccount(deleteClientTarget);
    setDeleteClientTarget(null);
    await loadData();
  }

  async function handleResetPassword() {
    if (resetTarget === null) return;
    await actions.resetClientPassword(resetTarget);
    setResetTarget(null);
    await loadData();
  }

  async function handleEditClient(e: React.FormEvent) {
    e.preventDefault();
    if (!editClient) return;
    await actions.updateClientAccount(editClient.id, editClientForm);
    setEditClient(null);
    await loadData();
  }

  async function handleAddInvoice(e: React.FormEvent) {
    e.preventDefault();
    await actions.addClientInvoice(invForm);
    setShowAddInvoice(false);
    setInvForm({ clientId: 0, invoiceNumber: "", billCoverage: "", amount: "", invoiceDueDate: "", status: "Pending", invoiceLink: "" });
    await loadData();
  }

  async function handleEditInvoice(e: React.FormEvent) {
    e.preventDefault();
    if (!editInv) return;
    await actions.updateClientInvoice(editInv.id, editInvForm);
    setEditInv(null);
    await loadData();
  }

  async function handleDeleteInvoice() {
    if (deleteInvTarget === null) return;
    await actions.deleteClientInvoice(deleteInvTarget);
    setDeleteInvTarget(null);
    await loadData();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Building2 size={24} />
          Client Management
        </h1>
      </div>

      <div className="flex gap-2">
        <button onClick={() => setTab("accounts")} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === "accounts" ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
          Client Accounts
        </button>
        <button onClick={() => setTab("invoices")} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === "invoices" ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
          Client Invoices
        </button>
      </div>

      {tab === "accounts" && (
        <>
          <div className="flex justify-end">
            <button onClick={() => setShowAddClient(true)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors">
              <Plus size={16} /> Add Client
            </button>
          </div>

          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-border">
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">ID</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">Name</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">Email</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">Company</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">Phone</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">Created</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map((c) => (
                    <tr key={c.id} className="border-b border-border hover:bg-slate-50/50">
                      <td className="px-4 py-3 font-mono text-foreground">{c.id}</td>
                      <td className="px-4 py-3 font-medium text-foreground">{c.displayName}</td>
                      <td className="px-4 py-3 text-foreground">{c.email}</td>
                      <td className="px-4 py-3 text-foreground">{c.companyName || "—"}</td>
                      <td className="px-4 py-3 text-foreground">{c.phone || "—"}</td>
                      <td className="px-4 py-3 text-foreground text-xs">{c.createdAt}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button onClick={() => { setEditClient(c); setEditClientForm({ displayName: c.displayName, companyName: c.companyName || "", address: c.address || "", phone: c.phone || "", email: c.email }); }} className="p-1.5 hover:bg-blue-50 rounded-lg" title="Edit">
                            <Pencil size={14} className="text-blue-600" />
                          </button>
                          <button onClick={() => setResetTarget(c.id)} className="p-1.5 hover:bg-amber-50 rounded-lg" title="Reset Password">
                            <KeyRound size={14} className="text-amber-600" />
                          </button>
                          <button onClick={() => setDeleteClientTarget(c.id)} className="p-1.5 hover:bg-red-50 rounded-lg" title="Delete">
                            <Trash2 size={14} className="text-red-600" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {tab === "invoices" && (
        <>
          <div className="flex justify-end">
            <button onClick={() => setShowAddInvoice(true)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors">
              <Plus size={16} /> Add Invoice
            </button>
          </div>

          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-border">
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">Client</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">Invoice #</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">Bill Coverage</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">Amount</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">Due Date</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">Status</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">Invoice Link</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="border-b border-border hover:bg-slate-50/50">
                      <td className="px-4 py-3 text-foreground">{clients.find((c) => c.id === inv.clientId)?.displayName || "—"}</td>
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
                      <td className="px-4 py-3 text-xs">
                        {inv.invoiceLink ? <a href={inv.invoiceLink} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline break-all">{inv.invoiceLink.slice(0, 40)}...</a> : <span className="text-slate-400">N/A</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button onClick={() => { setEditInv(inv); setEditInvForm({ clientId: inv.clientId, invoiceNumber: inv.invoiceNumber, billCoverage: inv.billCoverage, amount: inv.amount, invoiceDueDate: inv.invoiceDueDate, status: inv.status, invoiceLink: inv.invoiceLink }); }} className="p-1.5 hover:bg-blue-50 rounded-lg" title="Edit">
                            <Pencil size={14} className="text-blue-600" />
                          </button>
                          <button onClick={() => setDeleteInvTarget(inv.id)} className="p-1.5 hover:bg-red-50 rounded-lg" title="Delete">
                            <Trash2 size={14} className="text-red-600" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {invoices.length === 0 && (
                    <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400">No client invoices yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Add Client Modal */}
      {showAddClient && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2"><Plus size={20} className="text-indigo-600" /> Add Client Account</h2>
              <button onClick={() => setShowAddClient(false)} className="p-1 hover:bg-slate-100 rounded-lg"><X size={20} className="text-slate-500" /></button>
            </div>
            <form onSubmit={handleAddClient} className="p-6 space-y-4">
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Display Name *</label><input type="text" required value={clientForm.displayName} onChange={(e) => setClientForm((f) => ({ ...f, displayName: e.target.value }))} className={inputClass} placeholder="e.g. Devin Rubin" /></div>
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Email *</label><input type="email" required value={clientForm.email} onChange={(e) => setClientForm((f) => ({ ...f, email: e.target.value }))} className={inputClass} placeholder="e.g. client@company.com" /></div>
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Password</label><input type="text" value={clientForm.password} onChange={(e) => setClientForm((f) => ({ ...f, password: e.target.value }))} className={inputClass} /></div>
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Company Name</label><input type="text" value={clientForm.companyName} onChange={(e) => setClientForm((f) => ({ ...f, companyName: e.target.value }))} className={inputClass} placeholder="e.g. Acme Corp" /></div>
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Address</label><input type="text" value={clientForm.address} onChange={(e) => setClientForm((f) => ({ ...f, address: e.target.value }))} className={inputClass} placeholder="e.g. 123 Main St, City" /></div>
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Phone</label><input type="text" value={clientForm.phone} onChange={(e) => setClientForm((f) => ({ ...f, phone: e.target.value }))} className={inputClass} placeholder="e.g. +1 555-0100" /></div>
              {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowAddClient(false)} className="flex-1 border border-slate-300 text-slate-700 font-medium py-2.5 rounded-lg hover:bg-slate-50">Cancel</button>
                <button type="submit" className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 rounded-lg flex items-center justify-center gap-2"><Plus size={16} /> Create</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Client Modal */}
      {editClient && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2"><Pencil size={20} className="text-emerald-600" /> Edit Client</h2>
              <button onClick={() => setEditClient(null)} className="p-1 hover:bg-slate-100 rounded-lg"><X size={20} className="text-slate-500" /></button>
            </div>
            <form onSubmit={handleEditClient} className="p-6 space-y-4">
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Display Name *</label><input type="text" required value={editClientForm.displayName} onChange={(e) => setEditClientForm((f) => ({ ...f, displayName: e.target.value }))} className={inputClass} /></div>
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Email *</label><input type="email" required value={editClientForm.email} onChange={(e) => setEditClientForm((f) => ({ ...f, email: e.target.value }))} className={inputClass} /></div>
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Company Name</label><input type="text" value={editClientForm.companyName} onChange={(e) => setEditClientForm((f) => ({ ...f, companyName: e.target.value }))} className={inputClass} /></div>
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Address</label><input type="text" value={editClientForm.address} onChange={(e) => setEditClientForm((f) => ({ ...f, address: e.target.value }))} className={inputClass} /></div>
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Phone</label><input type="text" value={editClientForm.phone} onChange={(e) => setEditClientForm((f) => ({ ...f, phone: e.target.value }))} className={inputClass} /></div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setEditClient(null)} className="flex-1 border border-slate-300 text-slate-700 font-medium py-2.5 rounded-lg hover:bg-slate-50">Cancel</button>
                <button type="submit" className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2.5 rounded-lg flex items-center justify-center gap-2"><Save size={16} /> Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Invoice Modal */}
      {showAddInvoice && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2"><FileText size={20} className="text-indigo-600" /> Add Client Invoice</h2>
              <button onClick={() => setShowAddInvoice(false)} className="p-1 hover:bg-slate-100 rounded-lg"><X size={20} className="text-slate-500" /></button>
            </div>
            <form onSubmit={handleAddInvoice} className="p-6 space-y-4">
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Client *</label>
                <select required value={invForm.clientId || ""} onChange={(e) => setInvForm((f) => ({ ...f, clientId: parseInt(e.target.value) }))} className={inputClass}>
                  <option value="">Select a client</option>
                  {clients.map((c) => (<option key={c.id} value={c.id}>{c.displayName} ({c.email})</option>))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-xs font-medium text-slate-600 mb-1">Invoice Number *</label><input type="text" required value={invForm.invoiceNumber} onChange={(e) => setInvForm((f) => ({ ...f, invoiceNumber: e.target.value }))} className={inputClass} placeholder="e.g. INV-001" /></div>
                <div><label className="block text-xs font-medium text-slate-600 mb-1">Amount *</label><input type="text" required value={invForm.amount} onChange={(e) => setInvForm((f) => ({ ...f, amount: e.target.value }))} className={inputClass} placeholder="e.g. $2,500.00" /></div>
                <div><label className="block text-xs font-medium text-slate-600 mb-1">Bill Coverage *</label><input type="text" required value={invForm.billCoverage} onChange={(e) => setInvForm((f) => ({ ...f, billCoverage: e.target.value }))} className={inputClass} placeholder="e.g. Oct 1-15, 2026" /></div>
                <div><label className="block text-xs font-medium text-slate-600 mb-1">Due Date *</label><input type="text" required value={invForm.invoiceDueDate} onChange={(e) => setInvForm((f) => ({ ...f, invoiceDueDate: e.target.value }))} className={inputClass} placeholder="e.g. October 30, 2026" /></div>
                <div><label className="block text-xs font-medium text-slate-600 mb-1">Status</label>
                  <select value={invForm.status} onChange={(e) => setInvForm((f) => ({ ...f, status: e.target.value }))} className={inputClass}>
                    <option value="Pending">Pending</option>
                    <option value="Paid">Paid</option>
                    <option value="Overdue">Overdue</option>
                    <option value="Draft">Draft</option>
                  </select>
                </div>
                <div className="col-span-2"><label className="block text-xs font-medium text-slate-600 mb-1">Invoice Link</label><input type="text" value={invForm.invoiceLink} onChange={(e) => setInvForm((f) => ({ ...f, invoiceLink: e.target.value }))} className={inputClass} placeholder="https://drive.google.com/..." /></div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowAddInvoice(false)} className="flex-1 border border-slate-300 text-slate-700 font-medium py-2.5 rounded-lg hover:bg-slate-50">Cancel</button>
                <button type="submit" className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 rounded-lg flex items-center justify-center gap-2"><Plus size={16} /> Add Invoice</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Invoice Modal */}
      {editInv && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2"><Pencil size={20} className="text-emerald-600" /> Edit Invoice</h2>
              <button onClick={() => setEditInv(null)} className="p-1 hover:bg-slate-100 rounded-lg"><X size={20} className="text-slate-500" /></button>
            </div>
            <form onSubmit={handleEditInvoice} className="p-6 space-y-4">
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Client *</label>
                <select required value={editInvForm.clientId || ""} onChange={(e) => setEditInvForm((f) => ({ ...f, clientId: parseInt(e.target.value) }))} className={inputClass}>
                  <option value="">Select a client</option>
                  {clients.map((c) => (<option key={c.id} value={c.id}>{c.displayName} ({c.email})</option>))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-xs font-medium text-slate-600 mb-1">Invoice Number *</label><input type="text" required value={editInvForm.invoiceNumber} onChange={(e) => setEditInvForm((f) => ({ ...f, invoiceNumber: e.target.value }))} className={inputClass} /></div>
                <div><label className="block text-xs font-medium text-slate-600 mb-1">Amount *</label><input type="text" required value={editInvForm.amount} onChange={(e) => setEditInvForm((f) => ({ ...f, amount: e.target.value }))} className={inputClass} /></div>
                <div><label className="block text-xs font-medium text-slate-600 mb-1">Bill Coverage *</label><input type="text" required value={editInvForm.billCoverage} onChange={(e) => setEditInvForm((f) => ({ ...f, billCoverage: e.target.value }))} className={inputClass} /></div>
                <div><label className="block text-xs font-medium text-slate-600 mb-1">Due Date *</label><input type="text" required value={editInvForm.invoiceDueDate} onChange={(e) => setEditInvForm((f) => ({ ...f, invoiceDueDate: e.target.value }))} className={inputClass} /></div>
                <div><label className="block text-xs font-medium text-slate-600 mb-1">Status</label>
                  <select value={editInvForm.status} onChange={(e) => setEditInvForm((f) => ({ ...f, status: e.target.value }))} className={inputClass}>
                    <option value="Pending">Pending</option>
                    <option value="Paid">Paid</option>
                    <option value="Overdue">Overdue</option>
                    <option value="Draft">Draft</option>
                  </select>
                </div>
                <div className="col-span-2"><label className="block text-xs font-medium text-slate-600 mb-1">Invoice Link</label><input type="text" value={editInvForm.invoiceLink} onChange={(e) => setEditInvForm((f) => ({ ...f, invoiceLink: e.target.value }))} className={inputClass} /></div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setEditInv(null)} className="flex-1 border border-slate-300 text-slate-700 font-medium py-2.5 rounded-lg hover:bg-slate-50">Cancel</button>
                <button type="submit" className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2.5 rounded-lg flex items-center justify-center gap-2"><Save size={16} /> Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Client Confirm */}
      {deleteClientTarget !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="p-6 text-center space-y-4">
              <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto"><AlertTriangle className="text-red-600" size={28} /></div>
              <h3 className="text-lg font-bold text-slate-900">Delete Client?</h3>
              <p className="text-sm text-slate-500">This action cannot be undone.</p>
              <div className="flex gap-3">
                <button onClick={() => setDeleteClientTarget(null)} className="flex-1 border border-slate-300 text-slate-700 font-medium py-2.5 rounded-lg hover:bg-slate-50">Cancel</button>
                <button onClick={handleDeleteClient} className="flex-1 bg-red-600 hover:bg-red-700 text-white font-medium py-2.5 rounded-lg">Delete</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reset Password Confirm */}
      {resetTarget !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="p-6 text-center space-y-4">
              <div className="w-14 h-14 bg-amber-100 rounded-full flex items-center justify-center mx-auto"><KeyRound className="text-amber-600" size={28} /></div>
              <h3 className="text-lg font-bold text-slate-900">Reset Password?</h3>
              <p className="text-sm text-slate-500">Password will be reset to <span className="font-mono font-medium">gyclient2026</span></p>
              <div className="flex gap-3">
                <button onClick={() => setResetTarget(null)} className="flex-1 border border-slate-300 text-slate-700 font-medium py-2.5 rounded-lg hover:bg-slate-50">Cancel</button>
                <button onClick={handleResetPassword} className="flex-1 bg-amber-600 hover:bg-amber-700 text-white font-medium py-2.5 rounded-lg">Reset</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Invoice Confirm */}
      {deleteInvTarget !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="p-6 text-center space-y-4">
              <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto"><AlertTriangle className="text-red-600" size={28} /></div>
              <h3 className="text-lg font-bold text-slate-900">Delete Invoice?</h3>
              <p className="text-sm text-slate-500">This action cannot be undone.</p>
              <div className="flex gap-3">
                <button onClick={() => setDeleteInvTarget(null)} className="flex-1 border border-slate-300 text-slate-700 font-medium py-2.5 rounded-lg hover:bg-slate-50">Cancel</button>
                <button onClick={handleDeleteInvoice} className="flex-1 bg-red-600 hover:bg-red-700 text-white font-medium py-2.5 rounded-lg">Delete</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
