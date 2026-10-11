"use client";

import { useState, useEffect } from "react";
import { Clock, ExternalLink } from "lucide-react";
import * as actions from "@/lib/actions";
import type { ClientAccount } from "@/lib/actions";

export default function TimesheetPage() {
  const [clients, setClients] = useState<ClientAccount[]>([]);
  const [selectedClient, setSelectedClient] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const vaId = localStorage.getItem("vaId") || "";
      const assignedClients = await actions.getClientsForVA(vaId);
      setClients(assignedClients);
      if (assignedClients.length > 0) setSelectedClient(assignedClients[0].id);
      setLoading(false);
    })();
  }, []);

  const client = clients.find((c) => c.id === selectedClient);
  const sheetUrl = client?.timesheetUrl || "";

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
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
        <div className="flex items-center gap-3">
          {clients.length > 1 && (
            <select
              value={selectedClient ?? ""}
              onChange={(e) => setSelectedClient(Number(e.target.value))}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
            >
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.displayName}{c.companyName ? ` (${c.companyName})` : ""}</option>
              ))}
            </select>
          )}
          {sheetUrl && (
            <a
              href={sheetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
            >
              <ExternalLink size={16} />
              Open in Google Sheets
            </a>
          )}
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden flex-1 h-[calc(100%-3.5rem)]">
        {clients.length === 0 ? (
          <div className="flex items-center justify-center h-full text-slate-500">
            <div className="text-center">
              <Clock size={48} className="mx-auto text-slate-300 mb-4" />
              <p className="font-medium">No clients assigned</p>
              <p className="text-sm mt-1">You have no assigned clients yet.</p>
            </div>
          </div>
        ) : sheetUrl ? (
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
              <p className="font-medium">No timesheet URL configured</p>
              <p className="text-sm mt-1">The timesheet for {client?.displayName || "this client"} has not been set up yet.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
