"use client";

import { useEffect, useState } from "react";
import { ClipboardList, ExternalLink, AlertCircle } from "lucide-react";
import * as actions from "@/lib/actions";

type AssignmentInfo = { vaId: string; vaName: string; reportViewUrl: string };

export default function ClientReportsPage() {
  const [assignments, setAssignments] = useState<AssignmentInfo[]>([]);
  const [selectedVA, setSelectedVA] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const email = localStorage.getItem("clientEmail");
      if (!email) { setLoading(false); return; }
      const data = await actions.getAssignmentsByClientEmail(email);
      setAssignments(data.map((d) => ({ vaId: d.vaId, vaName: d.vaName, reportViewUrl: d.reportViewUrl })));
      if (data.length === 1) setSelectedVA(data[0].vaId);
      setLoading(false);
    })();
  }, []);

  const active = assignments.find((a) => a.vaId === selectedVA);
  const reportLink = active?.reportViewUrl || "";

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
      </div>
    );
  }

  if (assignments.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <ClipboardList size={24} /> Weekly Reports
        </h1>
        <div className="bg-card rounded-xl border border-border p-8 text-center">
          <AlertCircle size={48} className="mx-auto text-slate-300 mb-4" />
          <h2 className="text-lg font-semibold text-slate-700 mb-2">No VAs Assigned</h2>
          <p className="text-slate-500">You have no virtual assistants assigned yet.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 h-[calc(100vh-7rem)]">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <ClipboardList size={24} /> Weekly Reports
        </h1>
        {reportLink && (
          <a href={reportLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors">
            <ExternalLink size={16} /> Open in Google Sheets
          </a>
        )}
      </div>

      {assignments.length > 1 && (
        <select value={selectedVA} onChange={(e) => setSelectedVA(e.target.value)} className="px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 min-w-[220px]">
          <option value="">Select a VA</option>
          {assignments.map((a) => (
            <option key={a.vaId} value={a.vaId}>{a.vaName}</option>
          ))}
        </select>
      )}

      {!selectedVA ? (
        <div className="bg-card rounded-xl border border-border p-8 text-center">
          <ClipboardList size={48} className="mx-auto text-slate-300 mb-4" />
          <h2 className="text-lg font-semibold text-slate-700 mb-2">Select a VA</h2>
          <p className="text-slate-500">Choose a virtual assistant from the dropdown above to view their weekly report.</p>
        </div>
      ) : !reportLink ? (
        <div className="bg-card rounded-xl border border-border p-8 text-center">
          <AlertCircle size={48} className="mx-auto text-amber-300 mb-4" />
          <h2 className="text-lg font-semibold text-slate-700 mb-2">No Report Available</h2>
          <p className="text-slate-500">The weekly report for {active?.vaName} has not been configured yet.</p>
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-hidden flex-1 h-[calc(100%-8.5rem)]">
          <iframe src={reportLink} className="w-full h-full border-0" title={`Weekly Report - ${active?.vaName}`} allow="clipboard-write" />
        </div>
      )}
    </div>
  );
}
