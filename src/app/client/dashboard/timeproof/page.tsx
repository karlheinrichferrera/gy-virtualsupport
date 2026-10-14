"use client";

import { useEffect, useState } from "react";
import { Fingerprint, AlertCircle, CalendarDays, List, CalendarRange, ChevronLeft, ChevronRight } from "lucide-react";
import * as actions from "@/lib/actions";
import type { TimeproofEntry } from "@/lib/actions";
import { fmtTime12 } from "@/lib/est";

type EntryWithVA = TimeproofEntry & { vaName: string };

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

function getMonday(d: Date): Date {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.getFullYear(), d.getMonth(), diff);
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

export default function ClientTimeproofPage() {
  const [entries, setEntries] = useState<EntryWithVA[]>([]);
  const [filterVA, setFilterVA] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"list" | "week">("list");
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()));

  useEffect(() => {
    (async () => {
      const email = localStorage.getItem("clientEmail");
      if (!email) { setLoading(false); return; }
      const data = await actions.getTimeproofEntriesByClientEmail(email);
      setEntries(data);
      setLoading(false);
    })();
  }, []);

  const uniqueVAs = Array.from(new Map(entries.map((e) => [e.vaId, e.vaName])).entries());

  const filtered = entries.filter((e) => {
    if (filterVA && e.vaId !== filterVA) return false;
    if (viewMode === "list") {
      if (dateFrom && e.punchDate < dateFrom) return false;
      if (dateTo && e.punchDate > dateTo) return false;
    }
    return true;
  });

  const totalMins = filtered.reduce((sum, e) => sum + calcMins(e.timeIn, e.timeOut), 0);

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  const weekEnd = weekDays[6];
  const weekEntries = filtered.filter((e) => e.punchDate >= fmtDate(weekStart) && e.punchDate <= fmtDate(weekEnd));

  const weekVAIds = Array.from(new Set(weekEntries.map((e) => e.vaId)));
  const vaNameMap = new Map(entries.map((e) => [e.vaId, e.vaName]));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Fingerprint size={24} /> Timeproof
        </h1>
        <div className="flex bg-slate-100 rounded-lg p-0.5">
          <button onClick={() => setViewMode("list")} className={`px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-1.5 transition-colors ${viewMode === "list" ? "bg-white text-emerald-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
            <List size={14} /> List
          </button>
          <button onClick={() => setViewMode("week")} className={`px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-1.5 transition-colors ${viewMode === "week" ? "bg-white text-emerald-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
            <CalendarRange size={14} /> Week
          </button>
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
          <AlertCircle size={48} className="mx-auto text-slate-300 mb-4" />
          <h2 className="text-lg font-semibold text-slate-700 mb-2">No Time Entries</h2>
          <p className="text-slate-500">No timeproof entries from your virtual assistants yet.</p>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3 flex-wrap">
            <select value={filterVA} onChange={(e) => setFilterVA(e.target.value)} className="px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 min-w-[220px] bg-white text-slate-900">
              <option value="">All VAs</option>
              {uniqueVAs.map(([vaId, vaName]) => (
                <option key={vaId} value={vaId}>{vaId} - {vaName}</option>
              ))}
            </select>
          </div>

          {viewMode === "list" && (
            <>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <CalendarDays size={16} className="text-slate-400" />
                  <span className="text-sm text-slate-500">From</span>
                  <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white text-slate-900" />
                  <span className="text-sm text-slate-500">To</span>
                  <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white text-slate-900" />
                  {(dateFrom || dateTo) && (
                    <button onClick={() => { setDateFrom(""); setDateTo(""); }} className="text-xs text-slate-400 hover:text-slate-600 underline">Clear</button>
                  )}
                </div>
                {(dateFrom || dateTo) && totalMins > 0 && (
                  <div className="ml-auto bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-lg text-sm font-semibold">
                    Total: {fmtDuration(totalMins)}
                  </div>
                )}
              </div>

              {filtered.length === 0 ? (
                <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
                  <AlertCircle size={48} className="mx-auto text-slate-300 mb-4" />
                  <h2 className="text-lg font-semibold text-slate-700 mb-2">No Matching Entries</h2>
                  <p className="text-slate-500">No entries match the selected filters.</p>
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                          <th className="text-left px-4 py-3 font-semibold text-slate-600">VA</th>
                          <th className="text-left px-4 py-3 font-semibold text-slate-600">Type</th>
                          <th className="text-left px-4 py-3 font-semibold text-slate-600">Date</th>
                          <th className="text-left px-4 py-3 font-semibold text-slate-600">Time In</th>
                          <th className="text-left px-4 py-3 font-semibold text-slate-600">Time Out</th>
                          <th className="text-left px-4 py-3 font-semibold text-slate-600">Duration</th>
                          <th className="text-left px-4 py-3 font-semibold text-slate-600">Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.map((entry) => (
                          <tr key={entry.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 bg-white">
                            <td className="px-4 py-3 text-slate-900 font-medium">{entry.vaName}</td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                entry.entryType === "absence" ? "bg-amber-100 text-amber-700" :
                                entry.entryType === "leave" ? "bg-purple-100 text-purple-700" :
                                "bg-blue-100 text-blue-700"
                              }`}>
                                {entry.entryType === "absence" ? "Absent" : entry.entryType === "leave" ? "On Leave" : "Worked"}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-slate-700">{entry.punchDate}</td>
                            <td className="px-4 py-3 text-slate-700">{entry.entryType === "time" ? fmtTime12(entry.timeIn) : "—"}</td>
                            <td className="px-4 py-3 text-slate-700">{entry.entryType === "time" && entry.timeOut ? fmtTime12(entry.timeOut) : "—"}</td>
                            <td className="px-4 py-3 text-slate-600">{entry.entryType === "time" ? fmtDuration(calcMins(entry.timeIn, entry.timeOut)) : "—"}</td>
                            <td className="px-4 py-3 text-slate-500 max-w-[200px] truncate">{entry.notes || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                      {totalMins > 0 && (
                        <tfoot>
                          <tr className="bg-slate-50 border-t border-slate-200">
                            <td colSpan={5} className="px-4 py-3 text-right font-semibold text-slate-700">Total Hours:</td>
                            <td className="px-4 py-3 font-bold text-emerald-700">{fmtDuration(totalMins)}</td>
                            <td />
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
                <button onClick={() => setWeekStart((prev) => { const d = new Date(prev); d.setDate(d.getDate() - 7); return d; })} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-700 transition-colors">
                  <ChevronLeft size={18} />
                </button>
                <div className="text-sm font-semibold text-slate-700">
                  {shortDate(weekStart)} — {shortDate(weekEnd)}
                </div>
                <button onClick={() => setWeekStart((prev) => { const d = new Date(prev); d.setDate(d.getDate() + 7); return d; })} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-700 transition-colors">
                  <ChevronRight size={18} />
                </button>
                <button onClick={() => setWeekStart(getMonday(new Date()))} className="text-xs text-emerald-600 hover:text-emerald-800 font-medium ml-1">Today</button>
              </div>

              {weekVAIds.length === 0 ? (
                <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
                  <AlertCircle size={48} className="mx-auto text-slate-300 mb-4" />
                  <h2 className="text-lg font-semibold text-slate-700 mb-2">No Entries This Week</h2>
                  <p className="text-slate-500">No timeproof entries for the selected week.</p>
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                          <th className="text-left px-4 py-3 font-semibold text-slate-600 min-w-[140px]">VA</th>
                          {weekDays.map((d) => {
                            const isToday = fmtDate(d) === fmtDate(new Date());
                            return (
                              <th key={fmtDate(d)} className={`text-center px-2 py-3 font-semibold min-w-[100px] ${isToday ? "text-emerald-700 bg-emerald-50" : "text-slate-600"}`}>
                                <div>{shortDay(d)}</div>
                                <div className="text-xs font-normal">{shortDate(d)}</div>
                              </th>
                            );
                          })}
                          <th className="text-center px-3 py-3 font-semibold text-slate-700 min-w-[80px]">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {weekVAIds.map((vaId) => {
                          const vaEntries = weekEntries.filter((e) => e.vaId === vaId);
                          let weekTotal = 0;
                          return (
                            <tr key={vaId} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                              <td className="px-4 py-3 text-slate-900 font-medium">{vaNameMap.get(vaId) || vaId}</td>
                              {weekDays.map((d) => {
                                const dayStr = fmtDate(d);
                                const dayEntries = vaEntries.filter((e) => e.punchDate === dayStr);
                                const dayMins = dayEntries.filter((e) => e.entryType === "time").reduce((s, e) => s + calcMins(e.timeIn, e.timeOut), 0);
                                weekTotal += dayMins;
                                const hasAbsence = dayEntries.some((e) => e.entryType === "absence");
                                const hasLeave = dayEntries.some((e) => e.entryType === "leave");
                                const isToday = dayStr === fmtDate(new Date());
                                return (
                                  <td key={dayStr} className={`px-2 py-3 text-center ${isToday ? "bg-emerald-50/50" : ""}`}>
                                    {dayEntries.length === 0 ? (
                                      <span className="text-slate-300">—</span>
                                    ) : (
                                      <div className="space-y-1">
                                        {dayMins > 0 && <div className="text-slate-700 font-medium">{fmtDuration(dayMins)}</div>}
                                        {hasAbsence && <span className="inline-block px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700">Absent</span>}
                                        {hasLeave && <span className="inline-block px-1.5 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700">On Leave</span>}
                                      </div>
                                    )}
                                  </td>
                                );
                              })}
                              <td className="px-3 py-3 text-center font-bold text-emerald-700">{weekTotal > 0 ? fmtDuration(weekTotal) : "—"}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="bg-slate-50 border-t border-slate-200">
                          <td className="px-4 py-3 font-semibold text-slate-700">Team Total</td>
                          {weekDays.map((d) => {
                            const dayStr = fmtDate(d);
                            const dayMins = weekEntries.filter((e) => e.punchDate === dayStr && e.entryType === "time").reduce((s, e) => s + calcMins(e.timeIn, e.timeOut), 0);
                            const isToday = dayStr === fmtDate(new Date());
                            return (
                              <td key={dayStr} className={`px-2 py-3 text-center font-semibold text-slate-600 ${isToday ? "bg-emerald-50/50" : ""}`}>
                                {dayMins > 0 ? fmtDuration(dayMins) : "—"}
                              </td>
                            );
                          })}
                          <td className="px-3 py-3 text-center font-bold text-emerald-700">
                            {(() => { const t = weekEntries.filter((e) => e.entryType === "time").reduce((s, e) => s + calcMins(e.timeIn, e.timeOut), 0); return t > 0 ? fmtDuration(t) : "—"; })()}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
