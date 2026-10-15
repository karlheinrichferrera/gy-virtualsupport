"use client";

import { useEffect, useState } from "react";
import { Fingerprint, AlertCircle, CalendarDays, List, CalendarRange, ChevronLeft, ChevronRight, Download } from "lucide-react";
import * as XLSX from "xlsx";
import * as actions from "@/lib/actions";
import type { TimeproofEntry } from "@/lib/actions";
import type { VAProfile } from "@/lib/data";
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

export default function ClientTimeproofPage() {
  const [entries, setEntries] = useState<EntryWithVA[]>([]);
  const [vaProfiles, setVaProfiles] = useState<VAProfile[]>([]);
  const [filterVA, setFilterVA] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"list" | "week">("list");
  const [weekStart, setWeekStart] = useState(() => getBiweeklyStart(new Date()));

  useEffect(() => {
    (async () => {
      const email = localStorage.getItem("clientEmail");
      if (!email) { setLoading(false); return; }
      const [data, profiles] = await Promise.all([
        actions.getTimeproofEntriesByClientEmail(email),
        actions.getVAsByClientEmail(email),
      ]);
      setEntries(data);
      setVaProfiles(profiles);
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
  const vaNameMap = new Map(entries.map((e) => [e.vaId, e.vaName]));

  function downloadXLSX() {
    const source = viewMode === "week" ? weekEntries : filtered;
    const rows = source.map((e) => ({
      "VA ID": e.vaId,
      "VA Name": e.vaName,
      "Type": e.entryType === "absence" ? "Absent" : e.entryType === "leave" ? "On Leave" : "Worked",
      "Date": e.punchDate,
      "Time In": e.entryType === "time" ? fmtTime12(e.timeIn) : "",
      "Time Out": e.entryType === "time" && e.timeOut ? fmtTime12(e.timeOut) : "",
      "Duration": e.entryType === "time" ? fmtDuration(calcMins(e.timeIn, e.timeOut)) : "",
      "Notes": e.notes || "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Timeproof");
    const dateLabel = viewMode === "week" ? `${fmtDate(weekStart)}_to_${fmtDate(periodEnd)}` : dateFrom && dateTo ? `${dateFrom}_to_${dateTo}` : "all";
    XLSX.writeFile(wb, `timeproof_${dateLabel}.xlsx`);
  }

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
        <div className="flex items-center gap-2">
          <div className="flex bg-slate-100 rounded-lg p-0.5">
            <button onClick={() => setViewMode("list")} className={`px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-1.5 transition-colors ${viewMode === "list" ? "bg-white text-emerald-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
              <List size={14} /> List
            </button>
            <button onClick={() => setViewMode("week")} className={`px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-1.5 transition-colors ${viewMode === "week" ? "bg-white text-emerald-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
              <CalendarRange size={14} /> Biweekly
            </button>
          </div>
          <button onClick={downloadXLSX} className="bg-slate-600 hover:bg-slate-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors">
            <Download size={16} /> Download
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
                <button onClick={() => setWeekStart((prev) => { const d = new Date(prev); d.setDate(d.getDate() - 14); return d; })} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-700 transition-colors">
                  <ChevronLeft size={18} />
                </button>
                <div className="text-sm font-semibold text-slate-700">
                  {shortDate(weekStart)} — {shortDate(periodEnd)}
                </div>
                <button onClick={() => setWeekStart((prev) => { const d = new Date(prev); d.setDate(d.getDate() + 14); return d; })} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-700 transition-colors">
                  <ChevronRight size={18} />
                </button>
                <button onClick={() => setWeekStart(getBiweeklyStart(new Date()))} className="text-xs text-emerald-600 hover:text-emerald-800 font-medium ml-1">Today</button>
              </div>

              <div className="flex items-center gap-4 text-xs text-slate-500">
                <span className="font-medium text-slate-600">Legend:</span>
                <span className="flex items-center gap-1"><span className="inline-block px-1.5 py-0.5 rounded font-medium bg-blue-100 text-blue-700">3h 20m</span> Worked</span>
                <span className="flex items-center gap-1"><span className="inline-block px-1.5 py-0.5 rounded font-medium bg-amber-100 text-amber-700">A</span> Absent</span>
                <span className="flex items-center gap-1"><span className="inline-block px-1.5 py-0.5 rounded font-medium bg-purple-100 text-purple-700">L</span> On Leave</span>
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
                          <th colSpan={7} className="text-center px-2 py-1.5 font-semibold text-emerald-700 text-xs border-r border-slate-200">Week 1: {shortDate(week1Days[0])} – {shortDate(week1Days[6])}</th>
                          <th colSpan={7} className="text-center px-2 py-1.5 font-semibold text-emerald-700 text-xs">Week 2: {shortDate(week2Days[0])} – {shortDate(week2Days[6])}</th>
                          <th rowSpan={2} className="text-center px-3 py-2 font-semibold text-slate-700 min-w-[80px] border-l border-slate-200">Total</th>
                          <th rowSpan={2} className="text-center px-3 py-2 font-semibold text-slate-700 min-w-[80px] border-l border-slate-200">Scheduled</th>
                          <th rowSpan={2} className="text-center px-3 py-2 font-semibold text-slate-700 min-w-[80px] border-l border-slate-200">Overhours</th>
                        </tr>
                        <tr className="bg-slate-50 border-b border-slate-200">
                          {periodDays.map((d, i) => {
                            const isToday = fmtDate(d) === fmtDate(new Date());
                            return (
                              <th key={fmtDate(d)} className={`text-center px-1.5 py-2 font-semibold min-w-[72px] ${isToday ? "text-emerald-700 bg-emerald-50" : "text-slate-600"} ${i === 6 ? "border-r border-slate-200" : ""}`}>
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
                              <td className="px-4 py-3 text-slate-900 font-medium border-r border-slate-200 whitespace-nowrap">{vaNameMap.get(vaId) || vaId}</td>
                              {periodDays.map((d, i) => {
                                const dayStr = fmtDate(d);
                                const dayEntries = vaEntries.filter((e) => e.punchDate === dayStr);
                                const dayMins = dayEntries.filter((e) => e.entryType === "time").reduce((s, e) => s + calcMins(e.timeIn, e.timeOut), 0);
                                periodTotal += dayMins;
                                const hasAbsence = dayEntries.some((e) => e.entryType === "absence");
                                const hasLeave = dayEntries.some((e) => e.entryType === "leave");
                                const isToday = dayStr === fmtDate(new Date());
                                return (
                                  <td key={dayStr} className={`px-1.5 py-2 text-center ${isToday ? "bg-emerald-50/50" : ""} ${i === 6 ? "border-r border-slate-200" : ""}`}>
                                    {dayEntries.length === 0 ? (
                                      <span className="text-slate-300 text-xs">—</span>
                                    ) : (
                                      <div className="space-y-0.5">
                                        {dayMins > 0 && <div className="text-slate-700 font-medium text-xs">{fmtDuration(dayMins)}</div>}
                                        {hasAbsence && <span className="inline-block px-1 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-700">A</span>}
                                        {hasLeave && <span className="inline-block px-1 py-0.5 rounded text-[10px] font-medium bg-purple-100 text-purple-700">L</span>}
                                      </div>
                                    )}
                                  </td>
                                );
                              })}
                              {(() => {
                                const vaProfile = vaProfiles.find((v) => v.id === vaId);
                                const scheduledMins = getScheduledMins(vaProfile?.workSchedule, periodDays);
                                const overMins = periodTotal - scheduledMins;
                                return (
                                  <>
                                    <td className="px-3 py-3 text-center font-bold text-emerald-700 border-l border-slate-200">{periodTotal > 0 ? fmtDuration(periodTotal) : "—"}</td>
                                    <td className="px-3 py-3 text-center font-medium text-slate-600 border-l border-slate-200">{scheduledMins > 0 ? fmtDuration(scheduledMins) : "—"}</td>
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
                              <td key={dayStr} className={`px-1.5 py-3 text-center font-semibold text-slate-600 text-xs ${isToday ? "bg-emerald-50/50" : ""} ${i === 6 ? "border-r border-slate-200" : ""}`}>
                                {dayMins > 0 ? fmtDuration(dayMins) : "—"}
                              </td>
                            );
                          })}
                          {(() => {
                            const totalWorked = weekEntries.filter((e) => e.entryType === "time").reduce((s, e) => s + calcMins(e.timeIn, e.timeOut), 0);
                            const totalScheduled = weekVAIds.reduce((s, vaId) => {
                              const vaProfile = vaProfiles.find((v) => v.id === vaId);
                              return s + getScheduledMins(vaProfile?.workSchedule, periodDays);
                            }, 0);
                            const totalOver = totalWorked - totalScheduled;
                            return (
                              <>
                                <td className="px-3 py-3 text-center font-bold text-emerald-700 border-l border-slate-200">
                                  {totalWorked > 0 ? fmtDuration(totalWorked) : "—"}
                                </td>
                                <td className="px-3 py-3 text-center font-semibold text-slate-600 border-l border-slate-200">
                                  {totalScheduled > 0 ? fmtDuration(totalScheduled) : "—"}
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
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium min-w-[50px] justify-center ${
                            e.entryType === "absence" ? "bg-amber-100 text-amber-700" :
                            e.entryType === "leave" ? "bg-purple-100 text-purple-700" :
                            "bg-blue-100 text-blue-700"
                          }`}>
                            {e.entryType === "absence" ? "Absent" : e.entryType === "leave" ? "Leave" : "Work"}
                          </span>
                          <span className="text-slate-600">{e.notes}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </>
          )}
        </>
      )}
    </div>
  );
}
