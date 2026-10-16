"use client";

import { useEffect, useState } from "react";
import { Fingerprint, Plus, Pencil, Trash2, X, AlertCircle, CalendarDays, Clock } from "lucide-react";
import * as actions from "@/lib/actions";
import type { TimeproofEntry, ClientAccount } from "@/lib/actions";
import { estDate, estTime, estDateLong, localTZ, estToLocal, fmtTime12 } from "@/lib/est";

function round30(totalMins: number): number {
  return Math.round(totalMins / 30) * 30;
}

function calcMins(timeIn: string, timeOut: string): number {
  if (!timeIn || !timeOut) return 0;
  const [ih, im] = timeIn.split(":").map(Number);
  const [oh, om] = timeOut.split(":").map(Number);
  const m = round30(oh * 60 + om) - round30(ih * 60 + im);
  return m > 0 ? m : 0;
}

function fmtDuration(mins: number): string {
  if (mins <= 0) return "—";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m`;
}

export default function TimeproofPage() {
  const [clients, setClients] = useState<ClientAccount[]>([]);
  const [selectedClient, setSelectedClient] = useState<number | null>(null);
  const [entries, setEntries] = useState<TimeproofEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editEntry, setEditEntry] = useState<TimeproofEntry | null>(null);
  const [form, setForm] = useState({ punchDate: "", timeIn: "", timeOut: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showOTForm, setShowOTForm] = useState(false);
  const [otForm, setOTForm] = useState({ punchDate: "", timeIn: "", timeOut: "", notes: "" });
  const [otSaving, setOTSaving] = useState(false);

  const vaId = typeof window !== "undefined" ? localStorage.getItem("vaId") || "" : "";

  useEffect(() => {
    (async () => {
      const id = localStorage.getItem("vaId") || "";
      if (!id) { setLoading(false); return; }
      const assignedClients = await actions.getClientsForVA(id);
      setClients(assignedClients);
      if (assignedClients.length > 0) setSelectedClient(assignedClients[0].id);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!selectedClient || !vaId) return;
    (async () => {
      const data = await actions.getTimeproofEntriesForVAClient(vaId, selectedClient);
      setEntries(data);
    })();
  }, [selectedClient, vaId]);

  async function reload() {
    if (!selectedClient || !vaId) return;
    const data = await actions.getTimeproofEntriesForVAClient(vaId, selectedClient);
    setEntries(data);
  }

  function openCreate() {
    setForm({ punchDate: estDate(), timeIn: estTime(), timeOut: "", notes: "" });
    setEditEntry(null);
    setShowForm(true);
  }

  function openEdit(entry: TimeproofEntry) {
    setForm({ punchDate: entry.punchDate, timeIn: entry.timeIn, timeOut: entry.timeOut, notes: entry.notes });
    setEditEntry(entry);
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedClient || !vaId) return;
    setSaving(true);
    if (editEntry) {
      await actions.updateTimeproofEntry(editEntry.id, { punchDate: form.punchDate, timeIn: form.timeIn, timeOut: form.timeOut, notes: form.notes });
    } else {
      const now = estDateLong();
      await actions.addTimeproofEntry({ vaId, clientId: selectedClient, punchDate: form.punchDate, timeIn: form.timeIn, timeOut: form.timeOut, notes: form.notes, createdAt: now, entryType: "time", status: "approved" });
    }
    setSaving(false);
    setShowForm(false);
    await reload();
  }

  async function handleDelete(id: number) {
    await actions.deleteTimeproofEntry(id);
    await reload();
  }

  function punchOut(entry: TimeproofEntry) {
    const now = estTime();
    (async () => {
      await actions.updateTimeproofEntry(entry.id, { timeOut: now });
      await reload();
    })();
  }

  async function handleOTSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedClient || !vaId) return;
    setOTSaving(true);
    const now = estDateLong();
    await actions.addTimeproofEntry({ vaId, clientId: selectedClient, punchDate: otForm.punchDate, timeIn: otForm.timeIn, timeOut: otForm.timeOut, notes: otForm.notes, createdAt: now, entryType: "overtime", status: "pending" });
    setOTSaving(false);
    setShowOTForm(false);
    await reload();
  }

  const filtered = entries.filter((e) => {
    if (dateFrom && e.punchDate < dateFrom) return false;
    if (dateTo && e.punchDate > dateTo) return false;
    return true;
  });

  const totalMins = filtered.filter((e) => e.entryType !== "overtime" || e.status === "approved").reduce((sum, e) => sum + calcMins(e.timeIn, e.timeOut), 0);
  const tzLabel = localTZ();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (clients.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Fingerprint size={24} /> Timeproof
        </h1>
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
          <AlertCircle size={48} className="mx-auto text-slate-300 mb-4" />
          <h2 className="text-lg font-semibold text-slate-700 mb-2">No Clients Assigned</h2>
          <p className="text-slate-500">You have no client assignments yet. Please contact your administrator.</p>
        </div>
      </div>
    );
  }

  const inputClass = "w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Fingerprint size={24} /> Timeproof
        </h1>
        <div className="flex items-center gap-3">
          {clients.length > 1 && (
            <select value={selectedClient ?? ""} onChange={(e) => setSelectedClient(Number(e.target.value))} className="px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-w-[220px] bg-white text-slate-900">
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.displayName}{c.companyName ? ` (${c.companyName})` : ""}</option>
              ))}
            </select>
          )}
          <button onClick={() => { setOTForm({ punchDate: estDate(), timeIn: "", timeOut: "", notes: "" }); setShowOTForm(true); }} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors">
            <Clock size={16} /> Request Overtime
          </button>
          <button onClick={openCreate} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors">
            <Plus size={16} /> Punch In
          </button>
        </div>
      </div>

      {tzLabel && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 text-sm text-blue-700 flex items-center gap-2">
          <CalendarDays size={16} />
          Times are recorded in EST. Your local timezone: <span className="font-semibold">{tzLabel}</span>
        </div>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <CalendarDays size={16} className="text-slate-400" />
          <span className="text-sm text-slate-500">From</span>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-slate-900" />
          <span className="text-sm text-slate-500">To</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-slate-900" />
          {(dateFrom || dateTo) && (
            <button onClick={() => { setDateFrom(""); setDateTo(""); }} className="text-xs text-slate-400 hover:text-slate-600 underline">Clear</button>
          )}
        </div>
        {(dateFrom || dateTo) && totalMins > 0 && (
          <div className="ml-auto bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg text-sm font-semibold">
            Total: {fmtDuration(totalMins)}
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
          <Fingerprint size={48} className="mx-auto text-slate-300 mb-4" />
          <h2 className="text-lg font-semibold text-slate-700 mb-2">No Time Entries</h2>
          <p className="text-slate-500">{entries.length > 0 ? "No entries match the selected date range." : "Click \"Punch In\" to record your first time entry."}</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Date</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Type</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Time In</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Time Out</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Duration</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Notes</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Status</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((entry) => (
                  <tr key={entry.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 bg-white">
                    <td className="px-4 py-3 text-slate-900 font-medium">{entry.punchDate}</td>
                    <td className="px-4 py-3">
                      {(() => {
                        const types: Record<string, { label: string; bg: string; text: string }> = {
                          time: { label: "Worked", bg: "bg-blue-100", text: "text-blue-700" },
                          absence: { label: "Absent", bg: "bg-amber-100", text: "text-amber-700" },
                          leave: { label: "On Leave", bg: "bg-purple-100", text: "text-purple-700" },
                          holiday: { label: "Holiday", bg: "bg-green-100", text: "text-green-700" },
                          office_closed: { label: "Office Closed", bg: "bg-slate-200", text: "text-slate-600" },
                          overtime: { label: "Overtime", bg: "bg-red-100", text: "text-red-700" },
                        };
                        const t = types[entry.entryType] || types.time;
                        return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${t.bg} ${t.text}`}>{t.label}</span>;
                      })()}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {(entry.entryType === "time" || entry.entryType === "overtime") ? (
                        <>
                          {fmtTime12(entry.timeIn)}
                          {(() => { const l = estToLocal(entry.timeIn, entry.punchDate); return l ? <span className="text-xs text-slate-400 ml-1">({fmtTime12(l)} {tzLabel})</span> : null; })()}
                        </>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {(entry.entryType !== "time" && entry.entryType !== "overtime") ? "—" : entry.timeOut ? (
                        <span className="text-slate-700">
                          {fmtTime12(entry.timeOut)}
                          {(() => { const l = estToLocal(entry.timeOut, entry.punchDate); return l ? <span className="text-xs text-slate-400 ml-1">({fmtTime12(l)} {tzLabel})</span> : null; })()}
                        </span>
                      ) : (
                        <button onClick={() => punchOut(entry)} className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded font-medium hover:bg-amber-200 transition-colors">
                          Punch Out
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{(entry.entryType === "time" || entry.entryType === "overtime") ? fmtDuration(calcMins(entry.timeIn, entry.timeOut)) : "—"}</td>
                    <td className="px-4 py-3 text-slate-500 max-w-[200px] truncate">{entry.notes || "—"}</td>
                    <td className="px-4 py-3">
                      {entry.entryType === "overtime" ? (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          entry.status === "pending" ? "bg-amber-100 text-amber-700" :
                          entry.status === "approved" ? "bg-green-100 text-green-700" :
                          entry.status === "rejected" ? "bg-red-100 text-red-700" :
                          "bg-slate-100 text-slate-600"
                        }`}>
                          {entry.status === "pending" ? "Pending" : entry.status === "approved" ? "Approved" : entry.status === "rejected" ? "Rejected" : entry.status}
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {entry.entryType !== "overtime" && (
                          <button onClick={() => openEdit(entry)} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-blue-600 transition-colors">
                            <Pencil size={14} />
                          </button>
                        )}
                        {(entry.entryType !== "overtime" || entry.status === "pending") && (
                          <button onClick={() => handleDelete(entry.id)} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-red-600 transition-colors">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              {totalMins > 0 && (
                <tfoot>
                  <tr className="bg-slate-50 border-t border-slate-200">
                    <td colSpan={4} className="px-4 py-3 text-right font-semibold text-slate-700">Total Hours:</td>
                    <td className="px-4 py-3 font-bold text-blue-700">{fmtDuration(totalMins)}</td>
                    <td colSpan={3} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {showOTForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Clock size={20} className="text-red-600" /> Request Overtime
              </h2>
              <button onClick={() => setShowOTForm(false)} className="p-1 hover:bg-slate-100 rounded-lg">
                <X size={20} className="text-slate-500" />
              </button>
            </div>
            <form onSubmit={handleOTSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
                <input type="date" value={otForm.punchDate} onChange={(e) => setOTForm((f) => ({ ...f, punchDate: e.target.value }))} required className={inputClass} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Time In</label>
                  <input type="time" value={otForm.timeIn} onChange={(e) => setOTForm((f) => ({ ...f, timeIn: e.target.value }))} required className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Time Out</label>
                  <input type="time" value={otForm.timeOut} onChange={(e) => setOTForm((f) => ({ ...f, timeOut: e.target.value }))} required className={inputClass} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Reason</label>
                <input type="text" value={otForm.notes} onChange={(e) => setOTForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Reason for overtime" required className={inputClass} />
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700">
                Your overtime request will be sent to admin for approval.
              </div>
              <button type="submit" disabled={otSaving} className="w-full bg-red-600 hover:bg-red-700 text-white font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
                <Clock size={16} /> {otSaving ? "Submitting..." : "Submit Request"}
              </button>
            </form>
          </div>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Fingerprint size={20} className="text-blue-600" /> {editEntry ? "Edit Entry" : "Punch In"}
              </h2>
              <button onClick={() => setShowForm(false)} className="p-1 hover:bg-slate-100 rounded-lg">
                <X size={20} className="text-slate-500" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
                <input type="date" value={form.punchDate} onChange={(e) => setForm((f) => ({ ...f, punchDate: e.target.value }))} required className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Time In</label>
                <input type="time" value={form.timeIn} onChange={(e) => setForm((f) => ({ ...f, timeIn: e.target.value }))} required className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Time Out</label>
                <input type="time" value={form.timeOut} onChange={(e) => setForm((f) => ({ ...f, timeOut: e.target.value }))} className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                <input type="text" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Optional" className={inputClass} />
              </div>
              <button type="submit" disabled={saving} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
                <Fingerprint size={16} /> {saving ? "Saving..." : editEntry ? "Update Entry" : "Punch In"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
