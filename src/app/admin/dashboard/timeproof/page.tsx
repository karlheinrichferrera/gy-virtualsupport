"use client";

import { useEffect, useState } from "react";
import { Fingerprint, Plus, Pencil, Trash2, X, Search, AlertCircle } from "lucide-react";
import * as actions from "@/lib/actions";
import type { TimeproofEntry, ClientAccount } from "@/lib/actions";
import type { VAProfile } from "@/lib/data";

type FullEntry = TimeproofEntry & { vaName: string; clientName: string };

export default function AdminTimeproofPage() {
  const [allEntries, setAllEntries] = useState<FullEntry[]>([]);
  const [vas, setVAs] = useState<VAProfile[]>([]);
  const [clients, setClients] = useState<ClientAccount[]>([]);
  const [filterVA, setFilterVA] = useState("");
  const [filterClient, setFilterClient] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editEntry, setEditEntry] = useState<FullEntry | null>(null);
  const [form, setForm] = useState({ vaId: "", clientId: "", punchDate: "", timeIn: "", timeOut: "", notes: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const [entries, vaList, clientList] = await Promise.all([
        actions.getAllTimeproofEntries(),
        actions.getProfiles(),
        actions.getClientAccounts(),
      ]);
      setAllEntries(entries);
      setVAs(vaList);
      setClients(clientList);
      setLoading(false);
    })();
  }, []);

  async function reload() {
    const entries = await actions.getAllTimeproofEntries();
    setAllEntries(entries);
  }

  const filtered = allEntries.filter((e) => {
    if (filterVA && e.vaId !== filterVA) return false;
    if (filterClient && String(e.clientId) !== filterClient) return false;
    if (search) {
      const q = search.toLowerCase();
      return e.vaName.toLowerCase().includes(q) || e.clientName.toLowerCase().includes(q) || e.punchDate.includes(q);
    }
    return true;
  });

  function openCreate() {
    const now = new Date();
    setForm({ vaId: vas[0]?.id || "", clientId: String(clients[0]?.id || ""), punchDate: now.toISOString().slice(0, 10), timeIn: now.toTimeString().slice(0, 5), timeOut: "", notes: "" });
    setEditEntry(null);
    setShowForm(true);
  }

  function openEdit(entry: FullEntry) {
    setForm({ vaId: entry.vaId, clientId: String(entry.clientId), punchDate: entry.punchDate, timeIn: entry.timeIn, timeOut: entry.timeOut, notes: entry.notes });
    setEditEntry(entry);
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    if (editEntry) {
      await actions.updateTimeproofEntry(editEntry.id, { punchDate: form.punchDate, timeIn: form.timeIn, timeOut: form.timeOut, notes: form.notes });
    } else {
      const now = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
      await actions.addTimeproofEntry({ vaId: form.vaId, clientId: Number(form.clientId), punchDate: form.punchDate, timeIn: form.timeIn, timeOut: form.timeOut, notes: form.notes, createdAt: now });
    }
    setSaving(false);
    setShowForm(false);
    await reload();
  }

  async function handleDelete(id: number) {
    await actions.deleteTimeproofEntry(id);
    await reload();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  const inputClass = "w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Fingerprint size={24} /> Timeproof
        </h1>
        <button onClick={openCreate} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors">
          <Plus size={16} /> Add Entry
        </button>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
        </div>
        <select value={filterVA} onChange={(e) => setFilterVA(e.target.value)} className="px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 min-w-[180px]">
          <option value="">All VAs</option>
          {vas.map((va) => (
            <option key={va.id} value={va.id}>{va.id} - {va.firstName} {va.lastName}</option>
          ))}
        </select>
        <select value={filterClient} onChange={(e) => setFilterClient(e.target.value)} className="px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 min-w-[180px]">
          <option value="">All Clients</option>
          {clients.map((c) => (
            <option key={c.id} value={String(c.id)}>{c.displayName}{c.companyName ? ` (${c.companyName})` : ""}</option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-8 text-center">
          <AlertCircle size={48} className="mx-auto text-slate-300 mb-4" />
          <h2 className="text-lg font-semibold text-slate-700 mb-2">No Time Entries</h2>
          <p className="text-slate-500">No timeproof entries found.</p>
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-border">
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">VA</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Client</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Date</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Time In</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Time Out</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Duration</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Notes</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((entry) => {
                  let duration = "";
                  if (entry.timeIn && entry.timeOut) {
                    const [ih, im] = entry.timeIn.split(":").map(Number);
                    const [oh, om] = entry.timeOut.split(":").map(Number);
                    const mins = (oh * 60 + om) - (ih * 60 + im);
                    if (mins > 0) {
                      const h = Math.floor(mins / 60);
                      const m = mins % 60;
                      duration = `${h}h ${m}m`;
                    }
                  }
                  return (
                    <tr key={entry.id} className="border-b border-border last:border-0 hover:bg-slate-50">
                      <td className="px-4 py-3 text-slate-900 font-medium">{entry.vaName}</td>
                      <td className="px-4 py-3 text-slate-700">{entry.clientName}</td>
                      <td className="px-4 py-3 text-slate-700">{entry.punchDate}</td>
                      <td className="px-4 py-3 text-slate-700">{entry.timeIn}</td>
                      <td className="px-4 py-3 text-slate-700">{entry.timeOut || "—"}</td>
                      <td className="px-4 py-3 text-slate-500">{duration || "—"}</td>
                      <td className="px-4 py-3 text-slate-500 max-w-[160px] truncate">{entry.notes || "—"}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => openEdit(entry)} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-indigo-600 transition-colors">
                            <Pencil size={14} />
                          </button>
                          <button onClick={() => handleDelete(entry.id)} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-red-600 transition-colors">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Fingerprint size={20} className="text-indigo-600" /> {editEntry ? "Edit Entry" : "Add Entry"}
              </h2>
              <button onClick={() => setShowForm(false)} className="p-1 hover:bg-slate-100 rounded-lg">
                <X size={20} className="text-slate-500" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {!editEntry && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">VA</label>
                    <select value={form.vaId} onChange={(e) => setForm((f) => ({ ...f, vaId: e.target.value }))} required className={inputClass}>
                      {vas.map((va) => (
                        <option key={va.id} value={va.id}>{va.id} - {va.firstName} {va.lastName}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Client</label>
                    <select value={form.clientId} onChange={(e) => setForm((f) => ({ ...f, clientId: e.target.value }))} required className={inputClass}>
                      {clients.map((c) => (
                        <option key={c.id} value={String(c.id)}>{c.displayName}{c.companyName ? ` (${c.companyName})` : ""}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
                <input type="date" value={form.punchDate} onChange={(e) => setForm((f) => ({ ...f, punchDate: e.target.value }))} required className={inputClass} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Time In</label>
                  <input type="time" value={form.timeIn} onChange={(e) => setForm((f) => ({ ...f, timeIn: e.target.value }))} required className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Time Out</label>
                  <input type="time" value={form.timeOut} onChange={(e) => setForm((f) => ({ ...f, timeOut: e.target.value }))} className={inputClass} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                <input type="text" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Optional" className={inputClass} />
              </div>
              <button type="submit" disabled={saving} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
                <Fingerprint size={16} /> {saving ? "Saving..." : editEntry ? "Update Entry" : "Add Entry"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
