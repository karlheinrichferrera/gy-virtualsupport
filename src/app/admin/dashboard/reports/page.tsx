"use client";

import { useEffect, useState } from "react";
import { ClipboardList, ExternalLink, Search, AlertCircle } from "lucide-react";
import * as actions from "@/lib/actions";
import type { VAProfile } from "@/lib/data";

export default function AdminReportsPage() {
  const [vas, setVAs] = useState<VAProfile[]>([]);
  const [selectedVA, setSelectedVA] = useState<string>("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const list = await actions.getProfiles();
      setVAs(list);
      setLoading(false);
    })();
  }, []);

  const filtered = vas.filter((va) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      va.id.toLowerCase().includes(q) ||
      `${va.firstName} ${va.lastName}`.toLowerCase().includes(q)
    );
  });

  const activeVA = vas.find((va) => va.id === selectedVA);
  const reportLink = activeVA?.weeklyReportLink || "";

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4 h-[calc(100vh-7rem)]">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <ClipboardList size={24} />
          Weekly Reports
        </h1>
        {reportLink && (
          <a
            href={reportLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
          >
            <ExternalLink size={16} />
            Open in Google Sheets
          </a>
        )}
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search VA..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
        <select
          value={selectedVA}
          onChange={(e) => setSelectedVA(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 min-w-[220px]"
        >
          <option value="">Select a VA</option>
          {filtered.map((va) => (
            <option key={va.id} value={va.id}>
              {va.id} - {va.firstName} {va.lastName}
            </option>
          ))}
        </select>
      </div>

      {!selectedVA ? (
        <div className="bg-card rounded-xl border border-border p-8 text-center">
          <ClipboardList size={48} className="mx-auto text-slate-300 mb-4" />
          <h2 className="text-lg font-semibold text-slate-700 mb-2">Select a VA</h2>
          <p className="text-slate-500">Choose a VA from the dropdown above to view their weekly report.</p>
        </div>
      ) : !reportLink ? (
        <div className="bg-card rounded-xl border border-border p-8 text-center">
          <AlertCircle size={48} className="mx-auto text-amber-300 mb-4" />
          <h2 className="text-lg font-semibold text-slate-700 mb-2">No Report Link</h2>
          <p className="text-slate-500">
            {activeVA?.firstName} {activeVA?.lastName} does not have a weekly report link configured.
            You can set one in{" "}
            <a href="/admin/dashboard/vas" className="text-indigo-600 hover:underline">VA Management</a> by editing their profile.
          </p>
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-hidden flex-1 h-[calc(100%-8.5rem)]">
          <iframe
            src={reportLink}
            className="w-full h-full border-0"
            title={`Weekly Report - ${activeVA?.firstName} ${activeVA?.lastName}`}
            allow="clipboard-write"
          />
        </div>
      )}
    </div>
  );
}
