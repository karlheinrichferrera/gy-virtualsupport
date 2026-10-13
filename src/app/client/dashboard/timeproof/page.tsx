"use client";

import { useEffect, useState } from "react";
import { Fingerprint, AlertCircle, CalendarDays } from "lucide-react";
import * as actions from "@/lib/actions";
import type { TimeproofEntry } from "@/lib/actions";

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

export default function ClientTimeproofPage() {
  const [entries, setEntries] = useState<EntryWithVA[]>([]);
  const [filterVA, setFilterVA] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [loading, setLoading] = useState(true);

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
    if (dateFrom && e.punchDate < dateFrom) return false;
    if (dateTo && e.punchDate > dateTo) return false;
    return true;
  });

  const totalMins = filtered.reduce((sum, e) => sum + calcMins(e.timeIn, e.timeOut), 0);

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
                        <td className="px-4 py-3 text-slate-700">{entry.punchDate}</td>
                        <td className="px-4 py-3 text-slate-700">{entry.timeIn}</td>
                        <td className="px-4 py-3 text-slate-700">{entry.timeOut || "—"}</td>
                        <td className="px-4 py-3 text-slate-600">{fmtDuration(calcMins(entry.timeIn, entry.timeOut))}</td>
                        <td className="px-4 py-3 text-slate-500 max-w-[200px] truncate">{entry.notes || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                  {totalMins > 0 && (
                    <tfoot>
                      <tr className="bg-slate-50 border-t border-slate-200">
                        <td colSpan={4} className="px-4 py-3 text-right font-semibold text-slate-700">Total Hours:</td>
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
    </div>
  );
}
