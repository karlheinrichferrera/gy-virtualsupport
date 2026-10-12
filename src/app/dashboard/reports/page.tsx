"use client";

import { useEffect, useState } from "react";
import { ClipboardList, ExternalLink, AlertCircle } from "lucide-react";
import * as actions from "@/lib/actions";

type AssignmentInfo = { clientId: number; clientName: string; reportUrl: string };

export default function ReportsPage() {
  const [assignments, setAssignments] = useState<AssignmentInfo[]>([]);
  const [selectedClient, setSelectedClient] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const vaId = localStorage.getItem("vaId");
      if (!vaId) { setLoading(false); return; }
      const data = await actions.getAssignmentsForVA(vaId);
      setAssignments(data.map((d) => ({ clientId: d.clientId, clientName: d.clientName, reportUrl: d.reportUrl })));
      if (data.length === 1) setSelectedClient(String(data[0].clientId));
      setLoading(false);
    })();
  }, []);

  const active = assignments.find((a) => String(a.clientId) === selectedClient);
  const reportLink = active?.reportUrl || "";

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
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
          <h2 className="text-lg font-semibold text-slate-700 mb-2">No Clients Assigned</h2>
          <p className="text-slate-500">You have no client assignments yet. Please contact your administrator.</p>
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
        <select value={selectedClient} onChange={(e) => setSelectedClient(e.target.value)} className="px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-w-[220px]">
          <option value="">Select a Client</option>
          {assignments.map((a) => (
            <option key={a.clientId} value={String(a.clientId)}>{a.clientName}</option>
          ))}
        </select>
      )}

      {!selectedClient ? (
        <div className="bg-card rounded-xl border border-border p-8 text-center">
          <ClipboardList size={48} className="mx-auto text-slate-300 mb-4" />
          <h2 className="text-lg font-semibold text-slate-700 mb-2">Select a Client</h2>
          <p className="text-slate-500">Choose a client from the dropdown above to view their weekly report.</p>
        </div>
      ) : !reportLink ? (
        <div className="bg-card rounded-xl border border-border p-8 text-center">
          <AlertCircle size={48} className="mx-auto text-amber-300 mb-4" />
          <h2 className="text-lg font-semibold text-slate-700 mb-2">No Report Link</h2>
          <p className="text-slate-500">The weekly report for {active?.clientName} has not been configured yet. Please contact your administrator.</p>
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-hidden flex-1 h-[calc(100%-8.5rem)]">
          <iframe src={reportLink} className="w-full h-full border-0" title={`Weekly Report - ${active?.clientName}`} allow="clipboard-write" />
        </div>
      )}
    </div>
  );
}
