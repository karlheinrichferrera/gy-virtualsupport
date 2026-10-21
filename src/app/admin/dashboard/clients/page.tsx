"use client";

import { useState, useEffect, useRef } from "react";
import * as actions from "@/lib/actions";
import type { ClientAccount, ClientInvoice, ClientSalaryAdjustment } from "@/lib/actions";
import type { VAProfile } from "@/lib/data";
import ClientInvoicePreview from "@/components/ClientInvoicePreview";
import ClientInvoiceDownloadButton from "@/components/ClientInvoiceDownloadButton";
import InvoiceItemsEditor from "@/components/InvoiceItemsEditor";
import { invoiceItems, DEFAULT_INVOICE_PAYMENT_LINK, type InvoiceLineItem } from "@/lib/client-invoice-format";
import { clientInvoiceFileUrl } from "@/lib/invoice-links";
import { parseEmailAddresses } from "@/lib/email-addresses";
import { resendClientInvoiceEmail } from "@/lib/email-actions";
import { Building2, Plus, X, Trash2, AlertTriangle, KeyRound, FileText, Pencil, Save, DollarSign, Eye, RefreshCw, Mail } from "lucide-react";
import type { EmailJobStatus } from "@/lib/email-types";

const emailStatusLabels: Record<EmailJobStatus, string> = {
  queued: "Queued", sending: "Sending", accepted: "Accepted by Outlook", failed: "Failed",
  uncertain: "Needs review", skipped: "Skipped", cancelled: "Cancelled",
};

function InvoiceRecipients({ id, value, onChange }: { id: string; value: string; onChange: (value: string) => void }) {
  return <div><label htmlFor={id} className="block text-xs font-medium text-slate-600 mb-1">Additional recipients (optional)</label>
    <textarea id={id} rows={3} value={value} onChange={event => onChange(event.target.value)} className={inputClass} placeholder="name@example.com, another@example.com" aria-describedby={`${id}-help`} />
    <p id={`${id}-help`} className="mt-1 text-xs text-muted">CC up to 10 email addresses on this invoice only. Separate with commas or new lines.</p></div>;
}

const inputClass = "w-full min-w-0 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900";

export default function AdminClientsPage() {
  const [clients, setClients] = useState<ClientAccount[]>([]);
  const [invoices, setInvoices] = useState<ClientInvoice[]>([]);
  const [vaProfiles, setVaProfiles] = useState<VAProfile[]>([]);
  const [clientAdjs, setClientAdjs] = useState<ClientSalaryAdjustment[]>([]);
  const [showAddClient, setShowAddClient] = useState(false);
  const [showAddInvoice, setShowAddInvoice] = useState(false);
  const [showAddAdj, setShowAddAdj] = useState(false);
  const [deleteClientTarget, setDeleteClientTarget] = useState<number | null>(null);
  const [resetTarget, setResetTarget] = useState<number | null>(null);
  const [deleteInvTarget, setDeleteInvTarget] = useState<number | null>(null);
  const [deleteAdjTarget, setDeleteAdjTarget] = useState<number | null>(null);
  const [editAdj, setEditAdj] = useState<ClientSalaryAdjustment | null>(null);
  const [editAdjForm, setEditAdjForm] = useState({ clientId: 0, vaId: "", effectivityDate: "", type: "INCREASE", hourlyRate: "", salesCommission: "", referralBonus: "", notes: "" });
  const [editInv, setEditInv] = useState<ClientInvoice | null>(null);
  const [previewInvoice, setPreviewInvoice] = useState<ClientInvoice | null>(null);
  const [tab, setTab] = useState<"accounts" | "invoices" | "adjustments">("accounts");
  const [adjClientFilter, setAdjClientFilter] = useState<number>(0);
  const [adjVAFilter, setAdjVAFilter] = useState("");
  const [adjDateFilter, setAdjDateFilter] = useState("");

  const [clientForm, setClientForm] = useState({ clientCode: "", email: "", password: "gyclient2026", displayName: "", companyName: "", address: "", phone: "" });
  const [editClient, setEditClient] = useState<ClientAccount | null>(null);
  const [editClientForm, setEditClientForm] = useState({ clientCode: "", displayName: "", companyName: "", address: "", phone: "", email: "", timesheetUrl: "", timesheetViewUrl: "" });
  const [invForm, setInvForm] = useState({ clientId: 0, invoiceNumber: "", billFrom: "", billTo: "", amount: "", invoiceDueDate: "", status: "Pending", invoiceLink: "", additionalRecipients: "", lineItems: [{ title: "", description: "", amount: "" }] as InvoiceLineItem[], paymentLink: DEFAULT_INVOICE_PAYMENT_LINK });
  const [editInvForm, setEditInvForm] = useState({ clientId: 0, invoiceNumber: "", billFrom: "", billTo: "", amount: "", invoiceDueDate: "", status: "", invoiceLink: "", additionalRecipients: "", lineItems: [{ title: "", description: "", amount: "" }] as InvoiceLineItem[], paymentLink: DEFAULT_INVOICE_PAYMENT_LINK });
  const addItemized = invForm.clientId > 0 && clients.find(client => client.id === invForm.clientId)?.invoiceLayout !== "legacy";
  const [adjForm, setAdjForm] = useState({ clientId: 0, vaId: "", effectivityDate: "", type: "INCREASE", hourlyRate: "", salesCommission: "", referralBonus: "", notes: "" });
  const [error, setError] = useState("");
  const [invoiceError, setInvoiceError] = useState("");
  const [savingInvoice, setSavingInvoice] = useState(false);
  const [refreshingInvoices, setRefreshingInvoices] = useState(false);
  const [resendingInvoice, setResendingInvoice] = useState<number | null>(null);
  const [resendNotice, setResendNotice] = useState("");
  const resendRequests = useRef(new Map<number,string>());
  const resendInFlight = useRef(false);

  async function loadData() {
    const [c, i, vas, adjs] = await Promise.all([
      actions.getClientAccounts(),
      actions.getClientInvoices(),
      actions.getProfiles(),
      actions.getClientSalaryAdjustments(),
    ]);
    setClients(c);
    setInvoices(i);
    setVaProfiles(vas);
    setClientAdjs(adjs);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadData(); }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (tab !== "invoices") return;
    let active = true;
    const timer = window.setInterval(() => {
      void actions.getClientInvoices().then(rows => { if (active) setInvoices(rows); }).catch(() => {});
    }, 15000);
    return () => { active = false; window.clearInterval(timer); };
  }, [tab]);

  async function refreshInvoices() {
    setRefreshingInvoices(true);setInvoiceError("");
    try { setInvoices(await actions.getClientInvoices()); }
    catch { setInvoiceError("Unable to refresh email status. Please try again."); }
    finally { setRefreshingInvoices(false); }
  }

  async function resendInvoice(inv: ClientInvoice) {
    if (resendInFlight.current) return;
    const reviewedUncertain = inv.emailStatus === "uncertain";
    if (reviewedUncertain && !window.confirm("Check Outlook Sent Items first. This email may already have been sent. Have you checked and want to send another copy?")) return;
    resendInFlight.current = true;
    setResendingInvoice(inv.id);setInvoiceError("");setResendNotice("");
    let requestId = resendRequests.current.get(inv.id);
    if (!requestId) { requestId = crypto.randomUUID();resendRequests.current.set(inv.id,requestId); }
    try {
      const result = await resendClientInvoiceEmail(inv.id,requestId,reviewedUncertain);
      resendRequests.current.delete(inv.id);
      setInvoices(rows => rows.map(row => row.id === inv.id ? { ...row,emailStatus:result.status,emailError:null } : row));
      setResendNotice(`Invoice ${inv.invoiceNumber}: ${emailStatusLabels[result.status]}. Check Email status for updates.`);
      try { setInvoices(await actions.getClientInvoices()); } catch { /* Keep the confirmed queue status until the next refresh. */ }
    } catch (error) { setInvoiceError(error instanceof Error ? error.message : "Unable to resend the invoice email. Please try again."); }
    finally { resendInFlight.current = false;setResendingInvoice(null); }
  }

  async function handleAddClient(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
    const result = await actions.addClientAccount(clientForm.email, clientForm.password, clientForm.displayName, clientForm.companyName, clientForm.address, clientForm.phone, clientForm.clientCode);
    if (!result.success) { setError(result.error || "Failed"); return; }
    setShowAddClient(false);
    setClientForm({ clientCode: "", email: "", password: "gyclient2026", displayName: "", companyName: "", address: "", phone: "" });
    await loadData();
    } catch (error) { setError(error instanceof Error ? error.message : "Unable to save client."); }
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
    setError("");
    try {
    await actions.updateClientAccount(editClient.id, editClientForm);
    setEditClient(null);
    await loadData();
    } catch (error) { setError(error instanceof Error ? error.message : "Unable to save client."); }
  }

  function fmtCoverage(from: string, to: string): string {
    if (!from || !to) return "";
    const f = new Date(from + "T00:00:00");
    const t = new Date(to + "T00:00:00");
    const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" };
    return `${f.toLocaleDateString("en-US", opts)} – ${t.toLocaleDateString("en-US", opts)}`;
  }
  function fmtDueDate(d: string): string {
    if (!d) return "";
    const dt = new Date(d + "T00:00:00");
    return dt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  }

  function openEditInvoice(inv: ClientInvoice) {
    const asInputDate = (value = "") => {
      if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? "" : `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
    };
    const [from,to] = inv.billCoverage.split(/\s+[–—-]\s+/);
    setInvoiceError("");setEditInv(inv);
    setEditInvForm({ clientId: inv.clientId, invoiceNumber: inv.invoiceNumber, billFrom: asInputDate(from), billTo: asInputDate(to), amount: inv.amount,
      invoiceDueDate: asInputDate(inv.invoiceDueDate), status: inv.status, invoiceLink: inv.invoiceLink, additionalRecipients: inv.additionalRecipients || "",
      lineItems: inv.lineItems?.length ? inv.lineItems.map(item => ({ ...item })) : [{ title: "", description: "", amount: "" }], paymentLink: inv.paymentLink || "" });
  }

  async function handleAddInvoice(e: React.FormEvent) {
    e.preventDefault();
    if (savingInvoice) return;
    setInvoiceError("");setSavingInvoice(true);
    try {
      const additionalRecipients = parseEmailAddresses(invForm.additionalRecipients, 10).join(", ");
      const amount = addItemized ? invoiceItems(invForm.lineItems).amount : invForm.amount;
      const payload = { ...invForm, amount, additionalRecipients, billCoverage: fmtCoverage(invForm.billFrom, invForm.billTo), invoiceDueDate: fmtDueDate(invForm.invoiceDueDate) };
      await actions.addClientInvoice(payload);
      setShowAddInvoice(false);
      setInvForm({ clientId: 0, invoiceNumber: "", billFrom: "", billTo: "", amount: "", invoiceDueDate: "", status: "Pending", invoiceLink: "", additionalRecipients: "", lineItems: [{ title: "", description: "", amount: "" }] as InvoiceLineItem[], paymentLink: DEFAULT_INVOICE_PAYMENT_LINK });
      await loadData();
    } catch (error) { setInvoiceError(error instanceof Error ? error.message : "Unable to save invoice."); }
    finally { setSavingInvoice(false); }
  }

  async function handleEditInvoice(e: React.FormEvent) {
    e.preventDefault();
    if (!editInv || savingInvoice) return;
    setInvoiceError("");setSavingInvoice(true);
    try {
      const additionalRecipients = parseEmailAddresses(editInvForm.additionalRecipients, 10).join(", ");
      const amount = editInv.invoiceLayout === "itemized" ? invoiceItems(editInvForm.lineItems).amount : editInvForm.amount;
      const payload = { ...editInvForm, amount, additionalRecipients, billCoverage: fmtCoverage(editInvForm.billFrom, editInvForm.billTo), invoiceDueDate: fmtDueDate(editInvForm.invoiceDueDate) };
      await actions.updateClientInvoice(editInv.id, payload);
      setEditInv(null);
      await loadData();
    } catch (error) { setInvoiceError(error instanceof Error ? error.message : "Unable to save invoice."); }
    finally { setSavingInvoice(false); }
  }

  async function handleDeleteInvoice() {
    if (deleteInvTarget === null) return;
    await actions.deleteClientInvoice(deleteInvTarget);
    setDeleteInvTarget(null);
    await loadData();
  }

  async function handleAddAdj(e: React.FormEvent) {
    e.preventDefault();
    await actions.addClientSalaryAdjustment({
      clientId: adjForm.clientId,
      vaId: adjForm.vaId,
      effectivityDate: adjForm.effectivityDate,
      type: adjForm.type,
      hourlyRate: adjForm.hourlyRate,
      salesCommission: adjForm.salesCommission,
      referralBonus: adjForm.referralBonus,
      notes: adjForm.notes,
    });
    setShowAddAdj(false);
    setAdjForm({ clientId: 0, vaId: "", effectivityDate: "", type: "INCREASE", hourlyRate: "", salesCommission: "", referralBonus: "", notes: "" });
    await loadData();
  }

  async function handleEditAdj(e: React.FormEvent) {
    e.preventDefault();
    if (!editAdj) return;
    await actions.updateClientSalaryAdjustment(editAdj.id, {
      clientId: editAdjForm.clientId,
      vaId: editAdjForm.vaId,
      effectivityDate: editAdjForm.effectivityDate,
      type: editAdjForm.type,
      hourlyRate: editAdjForm.hourlyRate,
      salesCommission: editAdjForm.salesCommission,
      referralBonus: editAdjForm.referralBonus,
      notes: editAdjForm.notes,
    });
    setEditAdj(null);
    await loadData();
  }

  async function handleDeleteAdj() {
    if (deleteAdjTarget === null) return;
    await actions.deleteClientSalaryAdjustment(deleteAdjTarget);
    setDeleteAdjTarget(null);
    await loadData();
  }

  const filteredAdjs = clientAdjs.filter((a) => {
    if (adjClientFilter && a.clientId !== adjClientFilter) return false;
    if (adjVAFilter && a.vaId !== adjVAFilter) return false;
    if (adjDateFilter && !a.effectivityDate.toLowerCase().includes(adjDateFilter.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
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
        <button onClick={() => setTab("adjustments")} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === "adjustments" ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
          Salary Adjustments
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
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">Client ID</th>
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
                      <td className="px-4 py-3 font-mono text-foreground">{c.clientCode || "—"}</td>
                      <td className="px-4 py-3 font-medium text-foreground">{c.displayName}</td>
                      <td className="px-4 py-3 text-foreground">{c.email}</td>
                      <td className="px-4 py-3 text-foreground">{c.companyName || "—"}</td>
                      <td className="px-4 py-3 text-foreground">{c.phone || "—"}</td>
                      <td className="px-4 py-3 text-foreground text-xs">{c.createdAt}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button onClick={() => { setEditClient(c); setEditClientForm({ clientCode: c.clientCode || "", displayName: c.displayName, companyName: c.companyName || "", address: c.address || "", phone: c.phone || "", email: c.email, timesheetUrl: c.timesheetUrl || "", timesheetViewUrl: c.timesheetViewUrl || "" }); }} className="p-1.5 hover:bg-blue-50 rounded-lg" title="Edit">
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
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" disabled={refreshingInvoices} onClick={() => { void refreshInvoices(); }} className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm text-foreground disabled:opacity-50"><RefreshCw size={16} /> {refreshingInvoices ? "Refreshing..." : "Refresh email status"}</button>
            <button onClick={() => { setInvoiceError("");setShowAddInvoice(true); }} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors">
              <Plus size={16} /> Add Invoice
            </button>
          </div>

          <p className="text-xs text-muted">Email status refreshes every 15 seconds. Accepted by Outlook confirms the send request, not delivery to the recipient’s inbox. <a href="/admin/dashboard/email" className="text-indigo-600 underline">View email history</a></p>
          {invoiceError && !showAddInvoice && !editInv && <p role="alert" className="text-sm text-red-600">{invoiceError}</p>}
          {resendNotice && <p role="status" className="text-sm text-emerald-600">{resendNotice}</p>}

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
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">Email status</th>
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
                        <a href="/admin/dashboard/email" aria-label={`Email status for ${inv.invoiceNumber}: ${inv.emailStatus ? emailStatusLabels[inv.emailStatus] : "Not sent"}`} className={`inline-flex whitespace-nowrap rounded px-2 py-1 font-medium underline ${inv.emailStatus === "accepted" ? "bg-emerald-100 text-emerald-700" : inv.emailStatus === "failed" || inv.emailStatus === "uncertain" ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-700"}`}>{inv.emailStatus ? emailStatusLabels[inv.emailStatus] : "Not sent"}</a>
                        {inv.emailError && <p className="mt-1 max-w-56 break-words text-red-600">{inv.emailError}</p>}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {clientInvoiceFileUrl(inv.invoiceLink) ? <a href={clientInvoiceFileUrl(inv.invoiceLink)!} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline break-all">Open invoice file</a> : <span className="text-slate-400">No file attached</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button type="button" onClick={() => setPreviewInvoice(inv)} aria-label={`View invoice ${inv.invoiceNumber}`} className="inline-flex min-h-10 items-center gap-1.5 whitespace-nowrap rounded-lg px-2 text-indigo-600 hover:bg-indigo-50" title="View Invoice">
                            <Eye size={16} aria-hidden="true" /> <span className="text-xs font-medium">View</span>
                          </button>
                          {inv.invoiceLayout === "itemized" && <ClientInvoiceDownloadButton id={inv.id} invoiceNumber={inv.invoiceNumber} compact />}
                          <button type="button" onClick={() => { void resendInvoice(inv); }} disabled={resendingInvoice !== null || inv.status.trim().toLowerCase() === "draft" || inv.emailStatus === "queued" || inv.emailStatus === "sending"}
                            aria-label={`Resend email for ${inv.invoiceNumber}`} title={inv.status.trim().toLowerCase() === "draft" ? "Publish this draft before emailing it" : inv.emailStatus === "queued" || inv.emailStatus === "sending" ? "An invoice email is already queued or sending" : "Send another copy using this invoice’s current details and recipients"}
                            className="inline-flex min-h-10 items-center gap-1.5 whitespace-nowrap rounded-lg px-2 text-indigo-600 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-40">
                            <Mail size={16} aria-hidden="true" /><span className="text-xs font-medium">{resendingInvoice === inv.id ? "Queuing..." : "Resend email"}</span>
                          </button>
                          <button onClick={() => openEditInvoice(inv)} className="p-1.5 hover:bg-blue-50 rounded-lg" title="Edit">
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
                    <tr><td colSpan={9} className="px-4 py-8 text-center text-slate-400">No client invoices yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {tab === "adjustments" && (
        <>
          <div className="flex items-center gap-3 flex-wrap">
            <select value={adjClientFilter} onChange={(e) => setAdjClientFilter(parseInt(e.target.value))} className="px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 min-w-[200px]">
              <option value={0}>All Clients</option>
              {clients.map((c) => (<option key={c.id} value={c.id}>{c.displayName}</option>))}
            </select>
            <select value={adjVAFilter} onChange={(e) => setAdjVAFilter(e.target.value)} className="px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 min-w-[200px]">
              <option value="">All VAs</option>
              {vaProfiles.map((va) => (<option key={va.id} value={va.id}>{va.id} - {va.firstName} {va.lastName}</option>))}
            </select>
            <input type="text" value={adjDateFilter} onChange={(e) => setAdjDateFilter(e.target.value)} placeholder="Filter by date..." className="px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 min-w-[180px]" />
            <div className="flex-1" />
            <button onClick={() => setShowAddAdj(true)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors">
              <Plus size={16} /> Add Adjustment
            </button>
          </div>

          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-border">
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">Client</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">VA</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">Effectivity Date</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">Type</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">Hourly Rate</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">Commission</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">Referral</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">Notes</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAdjs.map((adj) => {
                    const client = clients.find((c) => c.id === adj.clientId);
                    const va = vaProfiles.find((v) => v.id === adj.vaId);
                    return (
                      <tr key={adj.id} className="border-b border-border hover:bg-slate-50/50">
                        <td className="px-4 py-3 text-foreground">{client?.displayName || "—"}</td>
                        <td className="px-4 py-3 text-foreground">{va ? `${va.id} - ${va.firstName} ${va.lastName}` : adj.vaId}</td>
                        <td className="px-4 py-3 text-foreground">{adj.effectivityDate}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            adj.type === "INCREASE" ? "bg-emerald-100 text-emerald-700" :
                            adj.type === "DECREASE" ? "bg-red-100 text-red-700" :
                            "bg-slate-100 text-slate-600"
                          }`}>{adj.type}</span>
                        </td>
                        <td className="px-4 py-3 font-medium text-foreground">{adj.hourlyRate}</td>
                        <td className="px-4 py-3 text-foreground">{adj.salesCommission}</td>
                        <td className="px-4 py-3 text-foreground">{adj.referralBonus}</td>
                        <td className="px-4 py-3 text-foreground text-xs">{adj.notes || "—"}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <button onClick={() => { setEditAdj(adj); setEditAdjForm({ clientId: adj.clientId, vaId: adj.vaId, effectivityDate: adj.effectivityDate, type: adj.type, hourlyRate: adj.hourlyRate, salesCommission: adj.salesCommission, referralBonus: adj.referralBonus, notes: adj.notes }); }} className="p-1.5 hover:bg-blue-50 rounded-lg" title="Edit">
                              <Pencil size={14} className="text-blue-600" />
                            </button>
                            <button onClick={() => setDeleteAdjTarget(adj.id)} className="p-1.5 hover:bg-red-50 rounded-lg" title="Delete">
                              <Trash2 size={14} className="text-red-600" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredAdjs.length === 0 && (
                    <tr><td colSpan={9} className="px-4 py-8 text-center text-slate-400">No client salary adjustments yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Add Adjustment Modal */}
      {showAddAdj && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2"><DollarSign size={20} className="text-indigo-600" /> Add Client Salary Adjustment</h2>
              <button onClick={() => setShowAddAdj(false)} className="p-1 hover:bg-slate-100 rounded-lg"><X size={20} className="text-slate-500" /></button>
            </div>
            <form onSubmit={handleAddAdj} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div><label className="block text-xs font-medium text-slate-600 mb-1">Client *</label>
                  <select required value={adjForm.clientId || ""} onChange={(e) => setAdjForm((f) => ({ ...f, clientId: parseInt(e.target.value) }))} className={inputClass}>
                    <option value="">Select a client</option>
                    {clients.map((c) => (<option key={c.id} value={c.id}>{c.displayName}</option>))}
                  </select>
                </div>
                <div><label className="block text-xs font-medium text-slate-600 mb-1">VA *</label>
                  <select required value={adjForm.vaId} onChange={(e) => setAdjForm((f) => ({ ...f, vaId: e.target.value }))} className={inputClass}>
                    <option value="">Select a VA</option>
                    {vaProfiles.map((va) => (<option key={va.id} value={va.id}>{va.id} - {va.firstName} {va.lastName}</option>))}
                  </select>
                </div>
                <div><label className="block text-xs font-medium text-slate-600 mb-1">Effectivity Date *</label><input type="text" required value={adjForm.effectivityDate} onChange={(e) => setAdjForm((f) => ({ ...f, effectivityDate: e.target.value }))} className={inputClass} placeholder="e.g. October 1, 2026" /></div>
                <div><label className="block text-xs font-medium text-slate-600 mb-1">Type *</label>
                  <select value={adjForm.type} onChange={(e) => setAdjForm((f) => ({ ...f, type: e.target.value }))} className={inputClass}>
                    <option value="INCREASE">INCREASE</option>
                    <option value="DECREASE">DECREASE</option>
                    <option value="BONUS">BONUS</option>
                    <option value="INITIAL">INITIAL</option>
                  </select>
                </div>
                <div><label className="block text-xs font-medium text-slate-600 mb-1">Hourly Rate</label><input type="text" value={adjForm.hourlyRate} onChange={(e) => setAdjForm((f) => ({ ...f, hourlyRate: e.target.value }))} className={inputClass} placeholder="e.g. $5.00" /></div>
                <div><label className="block text-xs font-medium text-slate-600 mb-1">Sales Commission</label><input type="text" value={adjForm.salesCommission} onChange={(e) => setAdjForm((f) => ({ ...f, salesCommission: e.target.value }))} className={inputClass} placeholder="e.g. 5%" /></div>
                <div><label className="block text-xs font-medium text-slate-600 mb-1">Referral Bonus</label><input type="text" value={adjForm.referralBonus} onChange={(e) => setAdjForm((f) => ({ ...f, referralBonus: e.target.value }))} className={inputClass} placeholder="e.g. $50" /></div>
                <div className="sm:col-span-2"><label className="block text-xs font-medium text-slate-600 mb-1">Notes</label><input type="text" value={adjForm.notes} onChange={(e) => setAdjForm((f) => ({ ...f, notes: e.target.value }))} className={inputClass} placeholder="Optional notes" /></div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowAddAdj(false)} className="flex-1 border border-slate-300 text-slate-700 font-medium py-2.5 rounded-lg hover:bg-slate-50">Cancel</button>
                <button type="submit" className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 rounded-lg flex items-center justify-center gap-2"><Plus size={16} /> Add</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Adjustment Confirm */}
      {deleteAdjTarget !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="p-6 text-center space-y-4">
              <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto"><AlertTriangle className="text-red-600" size={28} /></div>
              <h3 className="text-lg font-bold text-slate-900">Delete Adjustment?</h3>
              <p className="text-sm text-slate-500">This action cannot be undone.</p>
              <div className="flex gap-3">
                <button onClick={() => setDeleteAdjTarget(null)} className="flex-1 border border-slate-300 text-slate-700 font-medium py-2.5 rounded-lg hover:bg-slate-50">Cancel</button>
                <button onClick={handleDeleteAdj} className="flex-1 bg-red-600 hover:bg-red-700 text-white font-medium py-2.5 rounded-lg">Delete</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Adjustment Modal */}
      {editAdj && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2"><Pencil size={20} className="text-emerald-600" /> Edit Client Salary Adjustment</h2>
              <button onClick={() => setEditAdj(null)} className="p-1 hover:bg-slate-100 rounded-lg"><X size={20} className="text-slate-500" /></button>
            </div>
            <form onSubmit={handleEditAdj} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div><label className="block text-xs font-medium text-slate-600 mb-1">Client *</label>
                  <select required value={editAdjForm.clientId || ""} onChange={(e) => setEditAdjForm((f) => ({ ...f, clientId: parseInt(e.target.value) }))} className={inputClass}>
                    <option value="">Select a client</option>
                    {clients.map((c) => (<option key={c.id} value={c.id}>{c.displayName}</option>))}
                  </select>
                </div>
                <div><label className="block text-xs font-medium text-slate-600 mb-1">VA *</label>
                  <select required value={editAdjForm.vaId} onChange={(e) => setEditAdjForm((f) => ({ ...f, vaId: e.target.value }))} className={inputClass}>
                    <option value="">Select a VA</option>
                    {vaProfiles.map((va) => (<option key={va.id} value={va.id}>{va.id} - {va.firstName} {va.lastName}</option>))}
                  </select>
                </div>
                <div><label className="block text-xs font-medium text-slate-600 mb-1">Effectivity Date *</label><input type="text" required value={editAdjForm.effectivityDate} onChange={(e) => setEditAdjForm((f) => ({ ...f, effectivityDate: e.target.value }))} className={inputClass} placeholder="e.g. October 1, 2026" /></div>
                <div><label className="block text-xs font-medium text-slate-600 mb-1">Type *</label>
                  <select value={editAdjForm.type} onChange={(e) => setEditAdjForm((f) => ({ ...f, type: e.target.value }))} className={inputClass}>
                    <option value="INCREASE">INCREASE</option>
                    <option value="DECREASE">DECREASE</option>
                    <option value="BONUS">BONUS</option>
                    <option value="INITIAL">INITIAL</option>
                  </select>
                </div>
                <div><label className="block text-xs font-medium text-slate-600 mb-1">Hourly Rate</label><input type="text" value={editAdjForm.hourlyRate} onChange={(e) => setEditAdjForm((f) => ({ ...f, hourlyRate: e.target.value }))} className={inputClass} placeholder="e.g. $5.00" /></div>
                <div><label className="block text-xs font-medium text-slate-600 mb-1">Sales Commission</label><input type="text" value={editAdjForm.salesCommission} onChange={(e) => setEditAdjForm((f) => ({ ...f, salesCommission: e.target.value }))} className={inputClass} placeholder="e.g. 5%" /></div>
                <div><label className="block text-xs font-medium text-slate-600 mb-1">Referral Bonus</label><input type="text" value={editAdjForm.referralBonus} onChange={(e) => setEditAdjForm((f) => ({ ...f, referralBonus: e.target.value }))} className={inputClass} placeholder="e.g. $50" /></div>
                <div className="sm:col-span-2"><label className="block text-xs font-medium text-slate-600 mb-1">Notes</label><input type="text" value={editAdjForm.notes} onChange={(e) => setEditAdjForm((f) => ({ ...f, notes: e.target.value }))} className={inputClass} placeholder="Optional notes" /></div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setEditAdj(null)} className="flex-1 border border-slate-300 text-slate-700 font-medium py-2.5 rounded-lg hover:bg-slate-50">Cancel</button>
                <button type="submit" className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2.5 rounded-lg flex items-center justify-center gap-2"><Save size={16} /> Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Client Modal */}
      {showAddClient && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full min-w-0 max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2"><Plus size={20} className="text-indigo-600" /> Add Client Account</h2>
              <button onClick={() => setShowAddClient(false)} className="p-1 hover:bg-slate-100 rounded-lg"><X size={20} className="text-slate-500" /></button>
            </div>
            <form onSubmit={handleAddClient} className="p-6 space-y-4">
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Display Name *</label><input type="text" required value={clientForm.displayName} onChange={(e) => setClientForm((f) => ({ ...f, displayName: e.target.value }))} className={inputClass} placeholder="e.g. Devin Rubin" /></div>
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Email *</label><input type="email" required value={clientForm.email} onChange={(e) => setClientForm((f) => ({ ...f, email: e.target.value }))} className={inputClass} placeholder="e.g. client@company.com" /></div>
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Password</label><input type="text" value={clientForm.password} onChange={(e) => setClientForm((f) => ({ ...f, password: e.target.value }))} className={inputClass} /></div>
              <div><label htmlFor="clientForm-client-id" className="block text-xs font-medium text-slate-600 mb-1">Client ID</label><input id="clientForm-client-id" type="text" maxLength={64} value={clientForm.clientCode} onChange={(e) => setClientForm((f) => ({ ...f, clientCode: e.target.value }))} className={inputClass} placeholder="e.g. CL-1001" /><p className="mt-1 text-xs text-slate-500">Optional reference only. Clients sign in with their email.</p></div>
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
          <div className="bg-white rounded-2xl shadow-2xl w-full min-w-0 max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2"><Pencil size={20} className="text-emerald-600" /> Edit Client</h2>
              <button onClick={() => setEditClient(null)} className="p-1 hover:bg-slate-100 rounded-lg"><X size={20} className="text-slate-500" /></button>
            </div>
            <form onSubmit={handleEditClient} className="p-6 space-y-4">
              {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Display Name *</label><input type="text" required value={editClientForm.displayName} onChange={(e) => setEditClientForm((f) => ({ ...f, displayName: e.target.value }))} className={inputClass} /></div>
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Email *</label><input type="email" required value={editClientForm.email} onChange={(e) => setEditClientForm((f) => ({ ...f, email: e.target.value }))} className={inputClass} /></div>
              <div><label htmlFor="editClientForm-client-id" className="block text-xs font-medium text-slate-600 mb-1">Client ID</label><input id="editClientForm-client-id" type="text" maxLength={64} value={editClientForm.clientCode} onChange={(e) => setEditClientForm((f) => ({ ...f, clientCode: e.target.value }))} className={inputClass} placeholder="e.g. CL-1001" /><p className="mt-1 text-xs text-slate-500">Optional reference only. Clients sign in with their email.</p></div>
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Company Name</label><input type="text" value={editClientForm.companyName} onChange={(e) => setEditClientForm((f) => ({ ...f, companyName: e.target.value }))} className={inputClass} /></div>
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Address</label><input type="text" value={editClientForm.address} onChange={(e) => setEditClientForm((f) => ({ ...f, address: e.target.value }))} className={inputClass} /></div>
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Phone</label><input type="text" value={editClientForm.phone} onChange={(e) => setEditClientForm((f) => ({ ...f, phone: e.target.value }))} className={inputClass} /></div>
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Timesheet URL (Editable - for VAs)</label><input type="text" value={editClientForm.timesheetUrl} onChange={(e) => setEditClientForm((f) => ({ ...f, timesheetUrl: e.target.value }))} className={inputClass} placeholder="https://docs.google.com/spreadsheets/d/.../edit" /></div>
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Timesheet URL (View Only - for Clients)</label><input type="text" value={editClientForm.timesheetViewUrl} onChange={(e) => setEditClientForm((f) => ({ ...f, timesheetViewUrl: e.target.value }))} className={inputClass} placeholder="https://docs.google.com/spreadsheets/d/e/.../pubhtml" /></div>
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
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90dvh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2"><FileText size={20} className="text-indigo-600" /> Add Client Invoice</h2>
              <button disabled={savingInvoice} onClick={() => setShowAddInvoice(false)} className="p-1 hover:bg-slate-100 rounded-lg disabled:opacity-50"><X size={20} className="text-slate-500" /></button>
            </div>
            <form onSubmit={handleAddInvoice} className="p-6 space-y-4">
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Client *</label>
                <select required value={invForm.clientId || ""} onChange={(e) => setInvForm((f) => ({ ...f, clientId: parseInt(e.target.value), additionalRecipients: "" }))} className={inputClass}>
                  <option value="">Select a client</option>
                  {clients.map((c) => (<option key={c.id} value={c.id}>{c.displayName} ({c.email})</option>))}
                </select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div><label className="block text-xs font-medium text-slate-600 mb-1">Invoice Number *</label><input type="text" required value={invForm.invoiceNumber} onChange={(e) => setInvForm((f) => ({ ...f, invoiceNumber: e.target.value }))} className={inputClass} placeholder="e.g. INV-001" /></div>
                {!(addItemized) && <div><label className="block text-xs font-medium text-slate-600 mb-1">Amount *</label><input type="text" required value={invForm.amount} onChange={(e) => setInvForm((f) => ({ ...f, amount: e.target.value }))} className={inputClass} placeholder="e.g. $2,500.00" /></div>}
                <div><label className="block text-xs font-medium text-slate-600 mb-1">Bill Coverage (From) *</label><input type="date" required value={invForm.billFrom} onChange={(e) => setInvForm((f) => ({ ...f, billFrom: e.target.value }))} className={inputClass} /></div>
                <div><label className="block text-xs font-medium text-slate-600 mb-1">Bill Coverage (To) *</label><input type="date" required value={invForm.billTo} onChange={(e) => setInvForm((f) => ({ ...f, billTo: e.target.value }))} className={inputClass} /></div>
                <div><label className="block text-xs font-medium text-slate-600 mb-1">Due Date *</label><input type="date" required value={invForm.invoiceDueDate} onChange={(e) => setInvForm((f) => ({ ...f, invoiceDueDate: e.target.value }))} className={inputClass} /></div>
                <div><label className="block text-xs font-medium text-slate-600 mb-1">Status</label>
                  <select value={invForm.status} onChange={(e) => setInvForm((f) => ({ ...f, status: e.target.value }))} className={inputClass}>
                    <option value="Pending">Pending</option>
                    <option value="Paid">Paid</option>
                    <option value="Overdue">Overdue</option>
                    <option value="Draft">Draft</option>
                  </select>
                </div>
                <div className="sm:col-span-2"><label className="block text-xs font-medium text-slate-600 mb-1">Invoice Link</label><input type="text" value={invForm.invoiceLink} onChange={(e) => setInvForm((f) => ({ ...f, invoiceLink: e.target.value }))} className={inputClass} placeholder="https://drive.google.com/..." /></div>
              </div>
              {addItemized && <>
                <InvoiceItemsEditor id="new-invoice-items" items={invForm.lineItems} onChange={lineItems => setInvForm(form => ({ ...form, lineItems }))} />
                <div><label htmlFor="new-invoice-payment-link" className="mb-1 block text-xs font-medium text-slate-600">Payment link (optional)</label><input id="new-invoice-payment-link" type="url" value={invForm.paymentLink} onChange={event => setInvForm(form => ({ ...form, paymentLink: event.target.value }))} className={inputClass} placeholder="https://wise.com/pay/..." /></div>
              </>}
              <InvoiceRecipients id="invoice-additional-recipients" value={invForm.additionalRecipients} onChange={value => setInvForm(form => ({ ...form, additionalRecipients: value }))} />
              {invoiceError && <p role="alert" className="text-sm text-red-600">{invoiceError}</p>}
              <div className="flex gap-3 pt-2">
                <button type="button" disabled={savingInvoice} onClick={() => setShowAddInvoice(false)} className="flex-1 border border-slate-300 text-slate-700 font-medium py-2.5 rounded-lg hover:bg-slate-50 disabled:opacity-50">Cancel</button>
                <button type="submit" disabled={savingInvoice} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50"><Plus size={16} /> {savingInvoice ? "Saving..." : "Add Invoice"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Invoice Modal */}
      {editInv && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90dvh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2"><Pencil size={20} className="text-emerald-600" /> Edit Invoice</h2>
              <button disabled={savingInvoice} onClick={() => setEditInv(null)} className="p-1 hover:bg-slate-100 rounded-lg disabled:opacity-50"><X size={20} className="text-slate-500" /></button>
            </div>
            <form onSubmit={handleEditInvoice} className="p-6 space-y-4">
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Client *</label>
                <select required disabled={editInv.invoiceLayout === "itemized"} value={editInvForm.clientId || ""} onChange={(e) => setEditInvForm((f) => ({ ...f, clientId: parseInt(e.target.value), additionalRecipients: "" }))} className={inputClass}>
                  <option value="">Select a client</option>
                  {clients.map((c) => (<option key={c.id} value={c.id}>{c.displayName} ({c.email})</option>))}
                </select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div><label className="block text-xs font-medium text-slate-600 mb-1">Invoice Number *</label><input type="text" required value={editInvForm.invoiceNumber} onChange={(e) => setEditInvForm((f) => ({ ...f, invoiceNumber: e.target.value }))} className={inputClass} /></div>
                {!(editInv.invoiceLayout === "itemized") && <div><label className="block text-xs font-medium text-slate-600 mb-1">Amount *</label><input type="text" required value={editInvForm.amount} onChange={(e) => setEditInvForm((f) => ({ ...f, amount: e.target.value }))} className={inputClass} /></div>}
                <div><label className="block text-xs font-medium text-slate-600 mb-1">Bill Coverage (From) *</label><input type="date" required value={editInvForm.billFrom} onChange={(e) => setEditInvForm((f) => ({ ...f, billFrom: e.target.value }))} className={inputClass} /></div>
                <div><label className="block text-xs font-medium text-slate-600 mb-1">Bill Coverage (To) *</label><input type="date" required value={editInvForm.billTo} onChange={(e) => setEditInvForm((f) => ({ ...f, billTo: e.target.value }))} className={inputClass} /></div>
                <div><label className="block text-xs font-medium text-slate-600 mb-1">Due Date *</label><input type="date" required value={editInvForm.invoiceDueDate} onChange={(e) => setEditInvForm((f) => ({ ...f, invoiceDueDate: e.target.value }))} className={inputClass} /></div>
                <div><label className="block text-xs font-medium text-slate-600 mb-1">Status</label>
                  <select value={editInvForm.status} onChange={(e) => setEditInvForm((f) => ({ ...f, status: e.target.value }))} className={inputClass}>
                    <option value="Pending">Pending</option>
                    <option value="Paid">Paid</option>
                    <option value="Overdue">Overdue</option>
                    <option value="Draft">Draft</option>
                  </select>
                </div>
                <div className="sm:col-span-2"><label className="block text-xs font-medium text-slate-600 mb-1">Invoice Link</label><input type="text" value={editInvForm.invoiceLink} onChange={(e) => setEditInvForm((f) => ({ ...f, invoiceLink: e.target.value }))} className={inputClass} /></div>
              </div>
              {editInv.invoiceLayout === "itemized" && <>
                <InvoiceItemsEditor id="edit-invoice-items" items={editInvForm.lineItems} onChange={lineItems => setEditInvForm(form => ({ ...form, lineItems }))} />
                <div><label htmlFor="edit-invoice-payment-link" className="mb-1 block text-xs font-medium text-slate-600">Payment link (optional)</label><input id="edit-invoice-payment-link" type="url" value={editInvForm.paymentLink} onChange={event => setEditInvForm(form => ({ ...form, paymentLink: event.target.value }))} className={inputClass} placeholder="https://wise.com/pay/..." /></div>
              </>}
              <InvoiceRecipients id="edit-invoice-additional-recipients" value={editInvForm.additionalRecipients} onChange={value => setEditInvForm(form => ({ ...form, additionalRecipients: value }))} />
              {editInv.emailStatus && <p className="text-xs text-muted">Recipients are fixed when an email is queued. Changes here do not update or resend an existing email.</p>}
              {invoiceError && <p role="alert" className="text-sm text-red-600">{invoiceError}</p>}
              <div className="flex gap-3 pt-2">
                <button type="button" disabled={savingInvoice} onClick={() => setEditInv(null)} className="flex-1 border border-slate-300 text-slate-700 font-medium py-2.5 rounded-lg hover:bg-slate-50 disabled:opacity-50">Cancel</button>
                <button type="submit" disabled={savingInvoice} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2.5 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50"><Save size={16} /> {savingInvoice ? "Saving..." : "Save Changes"}</button>
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
      {previewInvoice && <ClientInvoicePreview invoice={previewInvoice} client={clients.find(client => client.id === previewInvoice.clientId)} onClose={() => setPreviewInvoice(null)} />}
    </div>
  );
}
