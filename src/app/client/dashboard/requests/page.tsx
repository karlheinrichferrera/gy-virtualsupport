"use client";

import { useState, useEffect } from "react";
import * as actions from "@/lib/actions";
import type { LeaveRequest } from "@/lib/data";
import type { ApprovalStatus } from "@/lib/request-approvals";
import StatusBadge from "@/components/StatusBadge";
import ApprovalProgress from "@/components/ApprovalProgress";
import { CalendarDays, X, Eye } from "lucide-react";
import { fmtTime12 } from "@/lib/est";

type RequestItem = { vaId: string; vaName: string; request: LeaveRequest };
type OvertimeItem = actions.TimeproofEntry & { vaName: string };
export default function ClientRequestsPage() {
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [overtime, setOvertime] = useState<OvertimeItem[]>([]);
  const [tab, setTab] = useState<"requests" | "overtime">("requests");
  const [filter, setFilter] = useState("All");
  const [viewing, setViewing] = useState<RequestItem | null>(null);
  const [remark, setRemark] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  async function reload() {
    const [leaves, entries] = await Promise.all([actions.getClientRequests(), actions.getClientOvertimeRequests()]);
    setRequests(leaves); setOvertime(entries);
    setViewing(current => current ? leaves.find(row => row.request.id === current.request.id) || null : null);
  }
  useEffect(() => {
    Promise.all([actions.getClientRequests(), actions.getClientOvertimeRequests()])
      .then(([leaves, entries]) => { setRequests(leaves); setOvertime(entries); if (new URLSearchParams(window.location.search).get("type") === "overtime") setTab("overtime"); })
      .catch(err => setError(err instanceof Error ? err.message : "Unable to load requests."))
      .finally(() => setLoading(false));
  }, []);
  async function review(id: string | number, decision: ApprovalStatus) {
    setBusy(true); setError("");
    try {
      if (typeof id === "number") await actions.reviewClientOvertime(id, decision);
      else await actions.reviewClientRequest(id, decision);
      await reload();
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to save your decision."); }
    finally { setBusy(false); }
  }
  async function saveRemark() {
    if (!viewing) return;
    setBusy(true); setError("");
    try { await actions.updateClientRequestRemarks(viewing.request.id, remark); await reload(); }
    catch (err) { setError(err instanceof Error ? err.message : "Unable to save remarks."); }
    finally { setBusy(false); }
  }
  function controls(id: string | number, approval: LeaveRequest | OvertimeItem) {
    if (!approval.requiresDualApproval) return null;
    return <div className="flex flex-wrap gap-2">
      {approval.clientApproval === "Pending" ? <>
        <button disabled={busy} onClick={() => review(id, "Approved")} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-medium text-white disabled:opacity-50">Approve</button>
        <button disabled={busy} onClick={() => review(id, "Denied")} className="rounded-lg bg-red-600 px-3 py-2 text-xs font-medium text-white disabled:opacity-50">Deny</button>
      </> : <button disabled={busy} onClick={() => review(id, "Pending")} className="rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-700 disabled:opacity-50">Reset my decision</button>}
    </div>;
  }
  const otStatus = (entry: OvertimeItem) => entry.status === "approved" ? "Approved" : entry.status === "rejected" ? "Denied" : "Pending";
  const leaves = requests.filter(row => filter === "All" || row.request.status === filter);
  const entries = overtime.filter(row => filter === "All" || otStatus(row) === filter);
  return <div className="space-y-4">
    <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground"><CalendarDays size={24} />Requests & Approvals</h1>
    <p className="text-sm text-muted">Requests need approval from both the selected client and an administrator. A denial from either reviewer denies the request.</p>
    <div className="flex flex-wrap gap-2">
      {([['requests', 'Leave & Shift Adjustment'], ['overtime', 'Overtime']] as const).map(([value, label]) => <button key={value} onClick={() => { setTab(value); setFilter("All"); }} className={`rounded-lg px-3 py-2 text-sm ${tab === value ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-700'}`}>{label}</button>)}
    </div>
    <div className="flex flex-wrap gap-2">{["All", "Pending", "Approved", "Denied"].map(value => <button key={value} onClick={() => setFilter(value)} className={`rounded-lg px-3 py-1.5 text-sm ${filter === value ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-700'}`}>{value}</button>)}</div>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {loading ? <p className="text-muted">Loading requests…</p> : <div className="overflow-hidden rounded-xl border border-border bg-card"><div className="overflow-x-auto">
      <table className="w-full text-left text-sm"><thead><tr className="border-b border-border bg-slate-50 text-slate-600"><th className="px-4 py-3">VA</th><th className="px-4 py-3">Request</th><th className="px-4 py-3">Period</th><th className="px-4 py-3">Status & Approvals</th><th className="px-4 py-3">Actions</th></tr></thead>
        <tbody>{tab === "requests" ? leaves.map(item => <tr key={item.request.id} className="border-b border-border">
          <td className="px-4 py-3 text-foreground">{item.vaName}</td>
          <td className="px-4 py-3 text-foreground">{item.request.type}<span className="block text-xs text-muted">{item.request.id}</span></td>
          <td className="px-4 py-3 whitespace-nowrap text-foreground">{item.request.dateFrom} – {item.request.dateTo}</td>
          <td className="px-4 py-3"><StatusBadge status={item.request.status} /><ApprovalProgress approval={item.request} /></td>
          <td className="px-4 py-3"><div className="flex flex-wrap items-center gap-2"><button onClick={() => { setViewing(item); setRemark(item.request.clientRemarks || ""); }} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-700"><Eye size={14} />View</button>{controls(item.request.id, item.request)}</div></td>
        </tr>) : entries.map(entry => <tr key={entry.id} className="border-b border-border">
          <td className="px-4 py-3 text-foreground">{entry.vaName}</td><td className="max-w-xs px-4 py-3 text-foreground">Overtime<p className="mt-1 whitespace-pre-wrap break-words text-xs text-muted">{entry.notes || "—"}</p></td>
          <td className="px-4 py-3 whitespace-nowrap text-foreground">{entry.punchDate}<span className="block text-xs">{fmtTime12(entry.timeIn)} – {fmtTime12(entry.timeOut)}</span></td>
          <td className="px-4 py-3"><StatusBadge status={otStatus(entry)} /><ApprovalProgress approval={entry} /></td><td className="px-4 py-3">{controls(entry.id, entry)}</td>
        </tr>)}{(tab === "requests" ? leaves.length : entries.length) === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-muted">No requests found.</td></tr>}</tbody>
      </table></div></div>}
    {viewing && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setViewing(null)}><div role="dialog" aria-modal="true" aria-labelledby="request-detail-title" onClick={event => event.stopPropagation()} className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-xl">
      <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4"><h2 id="request-detail-title" className="text-lg font-bold text-slate-900">Request Details</h2><button aria-label="Close request details" onClick={() => setViewing(null)}><X size={20} className="text-slate-600" /></button></div>
      <div className="space-y-3 p-6 text-sm text-slate-900"><p><strong>VA:</strong> {viewing.vaName}</p><p><strong>Type:</strong> {viewing.request.type}</p><p><strong>Period:</strong> {viewing.request.dateFrom} – {viewing.request.dateTo}</p><p className="whitespace-pre-wrap break-words"><strong>Reason:</strong> {viewing.request.reason}</p><StatusBadge status={viewing.request.status} /><ApprovalProgress approval={viewing.request} />
        <p className="whitespace-pre-wrap break-words"><strong>Admin remarks:</strong> {viewing.request.adminRemarks || "—"}</p>
        <label className="block"><span className="mb-1 block font-medium">Your remarks</span><textarea value={remark} onChange={event => setRemark(event.target.value)} maxLength={5000} rows={3} className="w-full rounded-lg border border-slate-300 p-3" /></label>
        {error && <p role="alert" className="text-red-700">{error}</p>}<button disabled={busy} onClick={saveRemark} className="rounded-lg bg-emerald-600 px-4 py-2 text-white disabled:opacity-50">Save remarks</button>
        {controls(viewing.request.id, viewing.request)}
      </div></div></div>}
  </div>;
}
