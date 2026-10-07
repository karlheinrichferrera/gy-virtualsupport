"use client";

import { useState, useEffect } from "react";
import * as store from "@/lib/store";
import type { PendingRegistration } from "@/lib/data";
import StatusBadge from "@/components/StatusBadge";
import { UserPlus, Check, X } from "lucide-react";

export default function RegistrationsPage() {
  const [regs, setRegs] = useState<PendingRegistration[]>([]);

  useEffect(() => {
    setRegs(store.getRegistrations());
  }, []);

  function updateStatus(id: string, status: "Approved" | "Denied") {
    store.updateRegistrationStatus(id, status);
    setRegs(store.getRegistrations());
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">VA Registrations</h1>
        <span className="text-sm text-muted">
          {regs.filter((r) => r.status === "Pending").length} pending
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-sm text-muted">Total Applications</p>
          <p className="text-2xl font-bold text-foreground">{regs.length}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-sm text-amber-600">Pending Review</p>
          <p className="text-2xl font-bold text-amber-600">
            {regs.filter((r) => r.status === "Pending").length}
          </p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-sm text-emerald-600">Approved</p>
          <p className="text-2xl font-bold text-emerald-600">
            {regs.filter((r) => r.status === "Approved").length}
          </p>
        </div>
      </div>

      {regs.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-12 text-center">
          <UserPlus size={48} className="text-muted mx-auto mb-4" />
          <p className="text-lg font-medium text-foreground">No registrations</p>
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-border">
                  <th className="text-left px-6 py-3 font-semibold text-slate-600">ID</th>
                  <th className="text-left px-6 py-3 font-semibold text-slate-600">Name</th>
                  <th className="text-left px-6 py-3 font-semibold text-slate-600">Email</th>
                  <th className="text-left px-6 py-3 font-semibold text-slate-600">Phone</th>
                  <th className="text-left px-6 py-3 font-semibold text-slate-600">Position</th>
                  <th className="text-left px-6 py-3 font-semibold text-slate-600">Date Applied</th>
                  <th className="text-center px-6 py-3 font-semibold text-slate-600">Status</th>
                  <th className="text-center px-6 py-3 font-semibold text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {regs.map((reg) => (
                  <tr key={reg.id} className="border-b border-border hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 font-mono font-medium text-foreground">{reg.id}</td>
                    <td className="px-6 py-4 font-medium text-foreground">
                      {reg.firstName} {reg.lastName}
                    </td>
                    <td className="px-6 py-4 text-foreground">{reg.email}</td>
                    <td className="px-6 py-4 text-foreground">{reg.phone}</td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
                        {reg.position}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-foreground">{reg.dateApplied}</td>
                    <td className="px-6 py-4 text-center">
                      <StatusBadge status={reg.status} />
                    </td>
                    <td className="px-6 py-4 text-center">
                      {reg.status === "Pending" ? (
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => updateStatus(reg.id, "Approved")}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors"
                          >
                            <Check size={14} />
                            Approve
                          </button>
                          <button
                            onClick={() => updateStatus(reg.id, "Denied")}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                          >
                            <X size={14} />
                            Deny
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted">Reviewed</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
