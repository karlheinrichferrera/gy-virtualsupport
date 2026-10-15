"use client";

import { useEffect, useState } from "react";
import { Fingerprint, Plus, Pencil, Trash2, X, AlertCircle, CalendarDays, List, CalendarRange, ChevronLeft, ChevronRight, Download, Copy } from "lucide-react";
import * as XLSX from "xlsx";
import * as actions from "@/lib/actions";
import type { TimeproofEntry, ClientAccount } from "@/lib/actions";
import type { VAProfile } from "@/lib/data";
import { estDate, estTime, estDateLong, fmtTime12 } from "@/lib/est";

type FullEntry = TimeproofEntry & { vaName: string; clientName: string };

function calcMins(timeIn: string, timeOut: string): number {
  if (!timeIn || !timeOut) return 0;
  const [ih, im] = timeIn.split(":").map(Number);
  const [oh, om] = timeOut.split(":").map(Number);
  const m = (oh * 60 + om) - (ih * 60 + im);
  return m > 0 ? m : 0;
}

function fmtDuration(mins: number): string {
  if (mins <= 0) return "—";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m`;
}

const BIWEEKLY_ANCHOR = new Date(2026, 9, 5);

function getBiweeklyStart(d: Date): Date {
  const diffDays = Math.floor((d.getTime() - BIWEEKLY_ANCHOR.getTime()) / 86400000);
  const periodIndex = Math.floor(diffDays / 14);
  const start = new Date(BIWEEKLY_ANCHOR);
  start.setDate(start.getDate() + periodIndex * 14);
  return start;
}

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function shortDay(d: Date): string {
  return d.toLocaleDateString("en-US", { weekday: "short" });
}

function shortDate(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const DAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;

function getScheduledMins(schedule: VAProfile["workSchedule"] | undefined, days: Date[]): number {
  if (!schedule) return 0;
  let total = 0;
  for (const d of days) {
    const dayName = DAY_NAMES[d.getDay()];
    const s = schedule[dayName];
    if (s?.enabled && s.start && s.end) {
      total += calcMins(s.start, s.end);
    }
  }
  return total;
}

const ENTRY_TYPES: Record<string, { label: string; short: string; bg: string; text: string }> = {
  time: { label: "Worked", short: "W", bg: "bg-blue-100", text: "text-blue-700" },
  absence: { label: "Absent", short: "A", bg: "bg-amber-100", text: "text-amber-700" },
  leave: { label: "On Leave", short: "L", bg: "bg-purple-100", text: "text-purple-700" },
  holiday: { label: "Holiday", short: "H", bg: "bg-green-100", text: "text-green-700" },
  office_closed: { label: "Office Closed", short: "C", bg: "bg-slate-200", text: "text-slate-600" },
  overtime: { label: "Overtime", short: "OT", bg: "bg-red-100", text: "text-red-700" },
};

function entryBadge(type: string) {
  const t = ENTRY_TYPES[type] || ENTRY_TYPES.time;
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${t.bg} ${t.text}`}>{t.label}</span>;
}

export default function AdminTimeproofPage() {
  const [allEntries, setAllEntries] = useState<FullEntry[]>([]);
  const [vas, setVAs] = useState<VAProfile[]>([]);
  const [clients, setClients] = useState<ClientAccount[]>([]);
  const [filterVA, setFilterVA] = useState("");
  const [filterClient, setFilterClient] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editEntry, setEditEntry] = useState<FullEntry | null>(null);
  const [form, setForm] = useState({ vaId: "", clientId: "", punchDate: "", timeIn: "", timeOut: "", notes: "", entryType: "time" });
  const [saving, setSaving] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [bulkForm, setBulkForm] = useState({ vaIds: [] as string[], clientId: "", dateFrom: "", dateTo: "", entryType: "holiday", notes: "" });
  const [bulkSaving, setBulkSaving] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "week">("list");
  const [weekStart, setWeekStart] = useState(() => getBiweeklyStart(new Date()));

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
    if (viewMode === "list") {
      if (dateFrom && e.punchDate < dateFrom) return false;
      if (dateTo && e.punchDate > dateTo) return false;
    }
    return true;
  });

  const totalMins = filtered.reduce((sum, e) => sum + calcMins(e.timeIn, e.timeOut), 0);

  function openCreate() {
    setForm({ vaId: vas[0]?.id || "", clientId: String(clients[0]?.id || ""), punchDate: estDate(), timeIn: estTime(), timeOut: "", notes: "", entryType: "time" });
    setEditEntry(null);
    setShowForm(true);
  }

  function openEdit(entry: FullEntry) {
    setForm({ vaId: entry.vaId, clientId: String(entry.clientId), punchDate: entry.punchDate, timeIn: entry.timeIn, timeOut: entry.timeOut, notes: entry.notes, entryType: entry.entryType || "time" });
    setEditEntry(entry);
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const hasTime = form.entryType === "time" || form.entryType === "overtime";
    const timeIn = hasTime ? form.timeIn : "";
    const timeOut = hasTime ? form.timeOut : "";
    if (editEntry) {
      await actions.updateTimeproofEntry(editEntry.id, { punchDate: form.punchDate, timeIn, timeOut, notes: form.notes, entryType: form.entryType });
    } else {
      const now = estDateLong();
      await actions.addTimeproofEntry({ vaId: form.vaId, clientId: Number(form.clientId), punchDate: form.punchDate, timeIn, timeOut, notes: form.notes, createdAt: now, entryType: form.entryType });
    }
    setSaving(false);
    setShowForm(false);
    await reload();
  }

  async function handleDelete(id: number) {
    await actions.deleteTimeproofEntry(id);
    await reload();
  }

  function downloadXLSX() {
    const source = viewMode === "week" ? weekEntries : filtered;
    const rows = source.map((e) => ({
      "VA ID": e.vaId,
      "VA Name": e.vaName,
      "Client": e.clientName,
      "Type": (ENTRY_TYPES[e.entryType] || ENTRY_TYPES.time).label,
      "Date": e.punchDate,
      "Time In": (e.entryType === "time" || e.entryType === "overtime") ? fmtTime12(e.timeIn) : "",
      "Time Out": (e.entryType === "time" || e.entryType === "overtime") && e.timeOut ? fmtTime12(e.timeOut) : "",
      "Duration": (e.entryType === "time" || e.entryType === "overtime") ? fmtDuration(calcMins(e.timeIn, e.timeOut)) : "",
      "Notes": e.notes || "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Timeproof");
    const dateLabel = viewMode === "week" ? `${fmtDate(weekStart)}_to_${fmtDate(periodEnd)}` : dateFrom && dateTo ? `${dateFrom}_to_${dateTo}` : "all";
    XLSX.writeFile(wb, `timeproof_${dateLabel}.xlsx`);
  }

  const periodDays = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  const periodEnd = periodDays[13];
  const weekEntries = filtered.filter((e) => e.punchDate >= fmtDate(weekStart) && e.punchDate <= fmtDate(periodEnd));
  const week1Days = periodDays.slice(0, 7);
  const week2Days = periodDays.slice(7, 14);

  const weekVAIds = Array.from(new Set(weekEntries.map((e) => e.vaId)));
  const vaMap = new Map(vas.map((v) => [v.id, `${v.firstName} ${v.lastName}`]));

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
        <div className="flex items-center gap-2">
          <div className="flex bg-slate-100 rounded-lg p-0.5">
            <button onClick={() => setViewMode("list")} className={`px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-1.5 transition-colors ${viewMode === "list" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
              <List size={14} /> List
            </button>
            <button onClick={() => setViewMode("week")} className={`px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-1.5 transition-colors ${viewMode === "week" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
              <CalendarRange size={14} /> Biweekly
            </button>
          </div>
          <button onClick={downloadXLSX} className="bg-slate-600 hover:bg-slate-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors">
            <Download size={16} /> Download
          </button>
          <button onClick={() => { setBulkForm({ vaIds: [], clientId: String(clients[0]?.id || ""), dateFrom: estDate(), dateTo: estDate(), entryType: "holiday", notes: "" }); setShowBulk(true); }} className="bg-slate-700 hover:bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors">
            <Copy size={16} /> Bulk Add
          </button>
          <button onClick={openCreate} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors">
            <Plus size={16} /> Add Entry
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <select value={filterVA} onChange={(e) => setFilterVA(e.target.value)} className="px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 min-w-[220px] bg-white text-slate-900">
          <option value="">All VAs</option>
          {vas.map((va) => (
            <option key={va.id} value={va.id}>{va.id} - {va.firstName} {va.lastName}</option>
          ))}
        </select>
        <select value={filterClient} onChange={(e) => setFilterClient(e.target.value)} className="px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 min-w-[220px] bg-white text-slate-900">
          <option value="">All Clients</option>
          {clients.map((c) => (
            <option key={c.id} value={String(c.id)}>{c.displayName}{c.companyName ? ` (${c.companyName})` : ""}</option>
          ))}
        </select>
      </div>

      {viewMode === "list" && (
        <>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <CalendarDays size={16} className="text-slate-400" />
              <span className="text-sm text-slate-500">From</span>
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-slate-900" />
              <span className="text-sm text-slate-500">To</span>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-slate-900" />
              {(dateFrom || dateTo) && (
                <button onClick={() => { setDateFrom(""); setDateTo(""); }} className="text-xs text-slate-400 hover:text-slate-600 underline">Clear</button>
              )}
            </div>
            {(dateFrom || dateTo) && totalMins > 0 && (
              <div className="ml-auto bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-lg text-sm font-semibold">
                Total: {fmtDuration(totalMins)}
              </div>
            )}
          </div>

          {filtered.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
              <AlertCircle size={48} className="mx-auto text-slate-300 mb-4" />
              <h2 className="text-lg font-semibold text-slate-700 mb-2">No Time Entries</h2>
              <p className="text-slate-500">{allEntries.length > 0 ? "No entries match the current filters." : "No timeproof entries found."}</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="text-left px-4 py-3 font-semibold text-slate-600">VA</th>
                      <th className="text-left px-4 py-3 font-semibold text-slate-600">Client</th>
                      <th className="text-left px-4 py-3 font-semibold text-slate-600">Type</th>
                      <th className="text-left px-4 py-3 font-semibold text-slate-600">Date</th>
                      <th className="text-left px-4 py-3 font-semibold text-slate-600">Time In</th>
                      <th className="text-left px-4 py-3 font-semibold text-slate-600">Time Out</th>
                      <th className="text-left px-4 py-3 font-semibold text-slate-600">Duration</th>
                      <th className="text-left px-4 py-3 font-semibold text-slate-600">Notes</th>
                      <th className="text-right px-4 py-3 font-semibold text-slate-600">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((entry) => (
                      <tr key={entry.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 bg-white">
                        <td className="px-4 py-3 text-slate-900 font-medium">{entry.vaName}</td>
                        <td className="px-4 py-3 text-slate-700">{entry.clientName}</td>
                        <td className="px-4 py-3">{entryBadge(entry.entryType)}</td>
                        <td className="px-4 py-3 text-slate-700">{entry.punchDate}</td>
                        <td className="px-4 py-3 text-slate-700">{(entry.entryType === "time" || entry.entryType === "overtime") ? fmtTime12(entry.timeIn) : "—"}</td>
                        <td className="px-4 py-3 text-slate-700">{(entry.entryType === "time" || entry.entryType === "overtime") && entry.timeOut ? fmtTime12(entry.timeOut) : "—"}</td>
                        <td className="px-4 py-3 text-slate-600">{(entry.entryType === "time" || entry.entryType === "overtime") ? fmtDuration(calcMins(entry.timeIn, entry.timeOut)) : "—"}</td>
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
                    ))}
                  </tbody>
                  {totalMins > 0 && (
                    <tfoot>
                      <tr className="bg-slate-50 border-t border-slate-200">
                        <td colSpan={6} className="px-4 py-3 text-right font-semibold text-slate-700">Total Hours:</td>
                        <td className="px-4 py-3 font-bold text-indigo-700">{fmtDuration(totalMins)}</td>
                        <td colSpan={2} />
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {viewMode === "week" && (
        <>
          <div className="flex items-center gap-3">
            <button onClick={() => setWeekStart((prev) => { const d = new Date(prev); d.setDate(d.getDate() - 14); return d; })} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-700 transition-colors">
              <ChevronLeft size={18} />
            </button>
            <div className="text-sm font-semibold text-slate-700">
              {shortDate(weekStart)} — {shortDate(periodEnd)}
            </div>
            <button onClick={() => setWeekStart((prev) => { const d = new Date(prev); d.setDate(d.getDate() + 14); return d; })} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-700 transition-colors">
              <ChevronRight size={18} />
            </button>
            <button onClick={() => setWeekStart(getBiweeklyStart(new Date()))} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium ml-1">Today</button>
          </div>

          <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap">
            <span className="font-medium text-slate-600">Legend:</span>
            <span className="flex items-center gap-1"><span className="inline-block px-1.5 py-0.5 rounded font-medium bg-blue-100 text-blue-700">3h 20m</span> Worked</span>
            <span className="flex items-center gap-1"><span className="inline-block px-1.5 py-0.5 rounded font-medium bg-amber-100 text-amber-700">A</span> Absent</span>
            <span className="flex items-center gap-1"><span className="inline-block px-1.5 py-0.5 rounded font-medium bg-purple-100 text-purple-700">L</span> On Leave</span>
            <span className="flex items-center gap-1"><span className="inline-block px-1.5 py-0.5 rounded font-medium bg-green-100 text-green-700">H</span> Holiday</span>
            <span className="flex items-center gap-1"><span className="inline-block px-1.5 py-0.5 rounded font-medium bg-slate-200 text-slate-600">C</span> Office Closed</span>
            <span className="flex items-center gap-1"><span className="inline-block px-1.5 py-0.5 rounded font-medium bg-red-100 text-red-700">OT</span> Overtime</span>
          </div>

          {weekVAIds.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
              <AlertCircle size={48} className="mx-auto text-slate-300 mb-4" />
              <h2 className="text-lg font-semibold text-slate-700 mb-2">No Entries This Period</h2>
              <p className="text-slate-500">No timeproof entries for the selected two-week period.</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-200">
                      <th rowSpan={2} className="text-left px-4 py-2 font-semibold text-slate-600 min-w-[140px] border-r border-slate-200">VA</th>
                      <th colSpan={7} className="text-center px-2 py-1.5 font-semibold text-indigo-700 text-xs border-r border-slate-200">Week 1: {shortDate(week1Days[0])} – {shortDate(week1Days[6])}</th>
                      <th colSpan={7} className="text-center px-2 py-1.5 font-semibold text-indigo-700 text-xs">Week 2: {shortDate(week2Days[0])} – {shortDate(week2Days[6])}</th>
                      <th rowSpan={2} className="text-center px-3 py-2 font-semibold text-slate-700 min-w-[80px] border-l border-slate-200">Total</th>
                      <th rowSpan={2} className="text-center px-3 py-2 font-semibold text-slate-700 min-w-[80px] border-l border-slate-200">Overtime</th>
                    </tr>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      {periodDays.map((d, i) => {
                        const isToday = fmtDate(d) === fmtDate(new Date());
                        return (
                          <th key={fmtDate(d)} className={`text-center px-1.5 py-2 font-semibold min-w-[72px] ${isToday ? "text-indigo-700 bg-indigo-50" : "text-slate-600"} ${i === 6 ? "border-r border-slate-200" : ""}`}>
                            <div className="text-xs">{shortDay(d)}</div>
                            <div className="text-xs font-normal">{d.getDate()}</div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {[...weekVAIds].sort((a, b) => a.localeCompare(b)).map((vaId) => {
                      const vaEntries = weekEntries.filter((e) => e.vaId === vaId);
                      let periodTotal = 0;
                      return (
                        <tr key={vaId} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                          <td className="px-4 py-3 text-slate-900 font-medium border-r border-slate-200 whitespace-nowrap">{vaMap.get(vaId) || vaId}</td>
                          {periodDays.map((d, i) => {
                            const dayStr = fmtDate(d);
                            const dayEntries = vaEntries.filter((e) => e.punchDate === dayStr);
                            const dayMins = dayEntries.filter((e) => e.entryType === "time").reduce((s, e) => s + calcMins(e.timeIn, e.timeOut), 0);
                            periodTotal += dayMins;
                            const isToday = dayStr === fmtDate(new Date());
                            return (
                              <td key={dayStr} className={`px-1.5 py-2 text-center ${isToday ? "bg-indigo-50/50" : ""} ${i === 6 ? "border-r border-slate-200" : ""}`}>
                                {dayEntries.length === 0 ? (
                                  <span className="text-slate-300 text-xs">—</span>
                                ) : (
                                  <div className="space-y-0.5">
                                    {dayMins > 0 && <div className="text-slate-700 font-medium text-xs">{fmtDuration(dayMins)}</div>}
                                    {dayEntries.filter((e) => e.entryType !== "time").map((e) => {
                                      const t = ENTRY_TYPES[e.entryType] || ENTRY_TYPES.time;
                                      return <span key={e.id} className={`inline-block px-1 py-0.5 rounded text-[10px] font-medium ${t.bg} ${t.text}`}>{t.short}</span>;
                                    })}
                                  </div>
                                )}
                              </td>
                            );
                          })}
                          {(() => {
                            const vaProfile = vas.find((v) => v.id === vaId);
                            const scheduledMins = getScheduledMins(vaProfile?.workSchedule, periodDays);
                            const overtimeEntryMins = vaEntries.filter((e) => e.entryType === "overtime").reduce((s, e) => s + calcMins(e.timeIn, e.timeOut), 0);
                            const overMins = (periodTotal - scheduledMins) + overtimeEntryMins;
                            return (
                              <>
                                <td className="px-3 py-3 text-center font-bold text-indigo-700 border-l border-slate-200">{periodTotal > 0 ? fmtDuration(periodTotal) : "—"}</td>
                                <td className="px-3 py-3 text-center font-bold border-l border-slate-200 text-red-600">
                                  {overMins > 0 ? `+${fmtDuration(overMins)}` : "—"}
                                </td>
                              </>
                            );
                          })()}
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-50 border-t border-slate-200">
                      <td className="px-4 py-3 font-semibold text-slate-700 border-r border-slate-200">Team Total</td>
                      {periodDays.map((d, i) => {
                        const dayStr = fmtDate(d);
                        const dayMins = weekEntries.filter((e) => e.punchDate === dayStr && e.entryType === "time").reduce((s, e) => s + calcMins(e.timeIn, e.timeOut), 0);
                        const isToday = dayStr === fmtDate(new Date());
                        return (
                          <td key={dayStr} className={`px-1.5 py-3 text-center font-semibold text-slate-600 text-xs ${isToday ? "bg-indigo-50/50" : ""} ${i === 6 ? "border-r border-slate-200" : ""}`}>
                            {dayMins > 0 ? fmtDuration(dayMins) : "—"}
                          </td>
                        );
                      })}
                      {(() => {
                        const totalWorked = weekEntries.filter((e) => e.entryType === "time").reduce((s, e) => s + calcMins(e.timeIn, e.timeOut), 0);
                        const totalScheduled = weekVAIds.reduce((s, vaId) => {
                          const vaProfile = vas.find((v) => v.id === vaId);
                          return s + getScheduledMins(vaProfile?.workSchedule, periodDays);
                        }, 0);
                        const totalOvertimeEntries = weekEntries.filter((e) => e.entryType === "overtime").reduce((s, e) => s + calcMins(e.timeIn, e.timeOut), 0);
                        const totalOver = (totalWorked - totalScheduled) + totalOvertimeEntries;
                        return (
                          <>
                            <td className="px-3 py-3 text-center font-bold text-indigo-700 border-l border-slate-200">
                              {totalWorked > 0 ? fmtDuration(totalWorked) : "—"}
                            </td>
                            <td className="px-3 py-3 text-center font-bold border-l border-slate-200 text-red-600">
                              {totalOver > 0 ? `+${fmtDuration(totalOver)}` : "—"}
                            </td>
                          </>
                        );
                      })()}
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {(() => {
            const notesEntries = weekEntries.filter((e) => e.notes);
            if (notesEntries.length === 0) return null;
            return (
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <h3 className="text-sm font-semibold text-slate-700 mb-3">Notes for this period</h3>
                <div className="space-y-2">
                  {notesEntries.map((e) => (
                    <div key={e.id} className="flex items-start gap-3 text-sm">
                      <span className="text-slate-400 min-w-[80px]">{e.punchDate}</span>
                      <span className="font-medium text-slate-700 min-w-[120px]">{e.vaName}</span>
                      {(() => { const t = ENTRY_TYPES[e.entryType] || ENTRY_TYPES.time; return (
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium min-w-[50px] justify-center ${t.bg} ${t.text}`}>{t.label}</span>
                      ); })()}
                      <span className="text-slate-600">{e.notes}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </>
      )}

      {showBulk && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Copy size={20} className="text-indigo-600" /> Bulk Add Entries
              </h2>
              <button onClick={() => setShowBulk(false)} className="p-1 hover:bg-slate-100 rounded-lg">
                <X size={20} className="text-slate-500" />
              </button>
            </div>
            <form onSubmit={async (e) => {
              e.preventDefault();
              if (bulkForm.vaIds.length === 0) return;
              setBulkSaving(true);
              const start = new Date(bulkForm.dateFrom + "T00:00:00");
              const end = new Date(bulkForm.dateTo + "T00:00:00");
              const dates: string[] = [];
              for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                dates.push(fmtDate(d));
              }
              const now = estDateLong();
              const entries = bulkForm.vaIds.flatMap((vaId) =>
                dates.map((date) => ({
                  vaId,
                  clientId: Number(bulkForm.clientId),
                  punchDate: date,
                  timeIn: "",
                  timeOut: "",
                  notes: bulkForm.notes,
                  createdAt: now,
                  entryType: bulkForm.entryType,
                }))
              );
              await actions.addBulkTimeproofEntries(entries);
              setBulkSaving(false);
              setShowBulk(false);
              await reload();
            }} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Select VAs</label>
                <div className="border border-slate-300 rounded-lg max-h-40 overflow-y-auto p-2 space-y-1">
                  <label className="flex items-center gap-2 text-sm text-slate-700 px-2 py-1 hover:bg-slate-50 rounded cursor-pointer">
                    <input type="checkbox" checked={bulkForm.vaIds.length === vas.length} onChange={(e) => setBulkForm((f) => ({ ...f, vaIds: e.target.checked ? vas.map((v) => v.id) : [] }))} className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                    <span className="font-medium">Select All</span>
                  </label>
                  <hr className="border-slate-200" />
                  {vas.map((va) => (
                    <label key={va.id} className="flex items-center gap-2 text-sm text-slate-700 px-2 py-1 hover:bg-slate-50 rounded cursor-pointer">
                      <input type="checkbox" checked={bulkForm.vaIds.includes(va.id)} onChange={(e) => {
                        setBulkForm((f) => ({ ...f, vaIds: e.target.checked ? [...f.vaIds, va.id] : f.vaIds.filter((id) => id !== va.id) }));
                      }} className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                      {va.id} - {va.firstName} {va.lastName}
                    </label>
                  ))}
                </div>
                <p className="text-xs text-slate-400 mt-1">{bulkForm.vaIds.length} VA(s) selected</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Client</label>
                <select value={bulkForm.clientId} onChange={(e) => setBulkForm((f) => ({ ...f, clientId: e.target.value }))} required className={inputClass}>
                  {clients.map((c) => (
                    <option key={c.id} value={String(c.id)}>{c.displayName}{c.companyName ? ` (${c.companyName})` : ""}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Entry Type</label>
                <select value={bulkForm.entryType} onChange={(e) => setBulkForm((f) => ({ ...f, entryType: e.target.value }))} className={inputClass}>
                  <option value="time">Worked</option>
                  <option value="absence">Absent</option>
                  <option value="leave">On Leave</option>
                  <option value="holiday">Holiday</option>
                  <option value="office_closed">Office Closed</option>
                  <option value="overtime">Overtime</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Date From</label>
                  <input type="date" value={bulkForm.dateFrom} onChange={(e) => setBulkForm((f) => ({ ...f, dateFrom: e.target.value }))} required className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Date To</label>
                  <input type="date" value={bulkForm.dateTo} onChange={(e) => setBulkForm((f) => ({ ...f, dateTo: e.target.value }))} required className={inputClass} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                <input type="text" value={bulkForm.notes} onChange={(e) => setBulkForm((f) => ({ ...f, notes: e.target.value }))} placeholder="e.g. Christmas Day" className={inputClass} />
              </div>
              <button type="submit" disabled={bulkSaving || bulkForm.vaIds.length === 0} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
                <Copy size={16} /> {bulkSaving ? "Adding..." : `Add ${bulkForm.vaIds.length > 0 ? bulkForm.vaIds.length + " VA(s)" : ""} Entries`}
              </button>
            </form>
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
                <label className="block text-sm font-medium text-slate-700 mb-1">Entry Type</label>
                <select value={form.entryType} onChange={(e) => setForm((f) => ({ ...f, entryType: e.target.value }))} className={inputClass}>
                  <option value="time">Worked</option>
                  <option value="absence">Absent</option>
                  <option value="leave">On Leave</option>
                  <option value="holiday">Holiday</option>
                  <option value="office_closed">Office Closed</option>
                  <option value="overtime">Overtime</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
                <input type="date" value={form.punchDate} onChange={(e) => setForm((f) => ({ ...f, punchDate: e.target.value }))} required className={inputClass} />
              </div>
              {(form.entryType === "time" || form.entryType === "overtime") && (
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
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                <input type="text" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder={form.entryType === "time" ? "Optional" : "Reason for " + form.entryType} className={inputClass} />
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
