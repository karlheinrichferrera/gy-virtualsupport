"use client";

import { Clock, ExternalLink } from "lucide-react";

const SHEET_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vRmcfYdtU5RmIbrPA_AqWQs3Cj91IfyBcSwKFQRCiTEgcnw78w8fhJjmxyAykY56SVqMvPgb4Pw6Iv7/pubhtml";

export default function ClientTimesheetPage() {
  return (
    <div className="space-y-4 h-[calc(100vh-7rem)]">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Clock size={24} />
          Timesheet
        </h1>
        <a
          href={SHEET_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
        >
          <ExternalLink size={16} />
          Open in Browser
        </a>
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden flex-1 h-[calc(100%-3.5rem)]">
        <iframe
          src={SHEET_URL}
          className="w-full h-full border-0"
          title="Timesheet"
          allow="clipboard-write"
        />
      </div>
    </div>
  );
}
