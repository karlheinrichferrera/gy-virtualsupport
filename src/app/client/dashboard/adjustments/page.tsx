"use client";

import { useState, useEffect } from "react";
import * as actions from "@/lib/actions";
import type { VAProfile, SalaryAdjustment } from "@/lib/data";
import { DollarSign } from "lucide-react";

export default function ClientAdjustmentsPage() {
  const [vaProfiles, setVaProfiles] = useState<VAProfile[]>([]);
  const [selectedVA, setSelectedVA] = useState("");
  const [adjustments, setAdjustments] = useState<Record<string, (SalaryAdjustment & { id: number })[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const profiles = await actions.getProfiles();
      setVaProfiles(profiles);
      setSelectedVA(profiles[0]?.id || "");
      setAdjustments(await actions.getAllAdjustments());
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

  const currentAdj = adjustments[selectedVA] || [];
  const selectedProfile = vaProfiles.find((v) => v.id === selectedVA);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
        <DollarSign size={24} />
        Salary Adjustments
      </h1>

      <div className="flex items-center gap-3">
        <select
          value={selectedVA}
          onChange={(e) => setSelectedVA(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 min-w-[220px]"
        >
          {vaProfiles.map((va) => (
            <option key={va.id} value={va.id}>{va.id} - {va.firstName} {va.lastName}</option>
          ))}
        </select>
        {selectedProfile && (
          <span className="text-sm text-slate-500">Current Rate: <span className="font-medium text-foreground">{selectedProfile.currentRate}</span></span>
        )}
      </div>

      {currentAdj.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-8 text-center">
          <DollarSign size={48} className="mx-auto text-slate-300 mb-4" />
          <p className="text-slate-500">No salary adjustments recorded for this VA.</p>
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-border">
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Effectivity Date</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Type</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Hourly Rate</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Sales Commission</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Referral Bonus</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Notes</th>
                </tr>
              </thead>
              <tbody>
                {currentAdj.map((adj) => (
                  <tr key={adj.id} className="border-b border-border hover:bg-slate-50/50">
                    <td className="px-4 py-3 text-foreground">{adj.effectivityDate}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        adj.type === "INCREASE" ? "bg-emerald-100 text-emerald-700" :
                        adj.type === "DECREASE" ? "bg-red-100 text-red-700" :
                        "bg-slate-100 text-slate-600"
                      }`}>
                        {adj.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-foreground">{adj.hourlyRate}</td>
                    <td className="px-4 py-3 text-foreground">{adj.salesCommission}</td>
                    <td className="px-4 py-3 text-foreground">{adj.referralBonus}</td>
                    <td className="px-4 py-3 text-foreground text-xs">{adj.notes || "—"}</td>
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
