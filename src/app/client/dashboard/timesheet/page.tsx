"use client";

import { useState, useEffect } from "react";
import { Clock, ExternalLink } from "lucide-react";
import * as actions from "@/lib/actions";

export default function ClientTimesheetPage() {
  const [sheetUrl, setSheetUrl] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const email = localStorage.getItem("clientEmail") || "";
      const account = await actions.getClientAccountByEmail(email);
      if (account?.timesheetViewUrl) setSheetUrl(account.timesheetViewUrl);
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4 h-[calc(100vh-7rem)]">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Clock size={24} />
          Timesheet
        </h1>
        {sheetUrl && (
          <a
            href={sheetUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-emerald-700 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors"
          >
            <ExternalLink size={16} />
            Open in Browser
          </a>
        )}
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden flex-1 h-[calc(100%-3.5rem)]">
        {sheetUrl ? (
          <iframe
            src={sheetUrl}
            className="w-full h-full border-0"
            title="Timesheet"
            allow="clipboard-write"
          />
        ) : (
          <div className="flex items-center justify-center h-full text-slate-500">
            <div className="text-center">
              <Clock size={48} className="mx-auto text-slate-300 mb-4" />
              <p className="font-medium">No timesheet available</p>
              <p className="text-sm mt-1">Your timesheet has not been set up yet.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
