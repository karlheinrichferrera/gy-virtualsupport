"use client";

import { useEffect, useState } from "react";
import { ClipboardList, ExternalLink, AlertCircle } from "lucide-react";
import * as actions from "@/lib/actions";

export default function ReportsPage() {
  const [reportLink, setReportLink] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const vaId = localStorage.getItem("vaId");
      if (!vaId) { setLoading(false); return; }
      const profile = await actions.getProfile(vaId);
      setReportLink(profile?.weeklyReportLink || "");
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  if (!reportLink) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <ClipboardList size={24} />
          Weekly Reports
        </h1>
        <div className="bg-card rounded-xl border border-border p-8 text-center">
          <AlertCircle size={48} className="mx-auto text-slate-300 mb-4" />
          <h2 className="text-lg font-semibold text-slate-700 mb-2">No Report Link Set</h2>
          <p className="text-slate-500">Your weekly report sheet has not been configured yet. Please contact your administrator to set up your Google Sheet link.</p>
        </div>
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
        <a
          href={reportLink}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
        >
          <ExternalLink size={16} />
          Open in Google Sheets
        </a>
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden flex-1 h-[calc(100%-3.5rem)]">
        <iframe
          src={reportLink}
          className="w-full h-full border-0"
          title="Weekly Reports"
          allow="clipboard-write"
        />
      </div>
    </div>
  );
}
