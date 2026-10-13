"use client";

import { useEffect, useState } from "react";
import { Fingerprint, AlertCircle, Search } from "lucide-react";
import * as actions from "@/lib/actions";
import type { TimeproofEntry } from "@/lib/actions";

type EntryWithVA = TimeproofEntry & { vaName: string };

export default function ClientTimeproofPage() {
  const [entries, setEntries] = useState<EntryWithVA[]>([]);
  const [search, setSearch] = useState("");
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

  const filtered = entries.filter((e) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return e.vaName.toLowerCase().includes(q) || e.punchDate.includes(q);
  });

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
        <div className="bg-card rounded-xl border border-border p-8 text-center">
          <AlertCircle size={48} className="mx-auto text-slate-300 mb-4" />
          <h2 className="text-lg font-semibold text-slate-700 mb-2">No Time Entries</h2>
          <p className="text-slate-500">No timeproof entries from your virtual assistants yet.</p>
        </div>
      ) : (
        <>
          <div className="relative max-w-xs">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" placeholder="Search by VA or date..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500" />
          </div>

          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-border">
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">VA</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">Date</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">Time In</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">Time Out</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">Duration</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">Notes</th>
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
                        <td className="px-4 py-3 text-slate-700">{entry.punchDate}</td>
                        <td className="px-4 py-3 text-slate-700">{entry.timeIn}</td>
                        <td className="px-4 py-3 text-slate-700">{entry.timeOut || "—"}</td>
                        <td className="px-4 py-3 text-slate-500">{duration || "—"}</td>
                        <td className="px-4 py-3 text-slate-500 max-w-[200px] truncate">{entry.notes || "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
