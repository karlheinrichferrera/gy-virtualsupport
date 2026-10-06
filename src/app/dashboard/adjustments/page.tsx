"use client";

import { useEffect, useState } from "react";
import { getAdjustments, getVAProfile, type SalaryAdjustment } from "@/lib/data";
import { TrendingUp, ArrowUpRight } from "lucide-react";

export default function AdjustmentsPage() {
  const [adjustments, setAdjustments] = useState<SalaryAdjustment[]>([]);
  const [currentRate, setCurrentRate] = useState("");

  useEffect(() => {
    const id = localStorage.getItem("vaId") || "";
    setAdjustments(getAdjustments(id));
    const p = getVAProfile(id);
    if (p) setCurrentRate(p.currentRate);
  }, []);

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">
          Salary Adjustments
        </h1>
        <div className="bg-emerald-50 text-emerald-700 px-4 py-2 rounded-lg text-sm font-medium border border-emerald-200">
          Current Rate: {currentRate}
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-border">
                <th className="text-left px-6 py-3 font-semibold text-slate-600">
                  Date
                </th>
                <th className="text-left px-6 py-3 font-semibold text-slate-600">
                  Type
                </th>
                <th className="text-left px-6 py-3 font-semibold text-slate-600">
                  Hourly Rate
                </th>
                <th className="text-left px-6 py-3 font-semibold text-slate-600">
                  Sales Commission
                </th>
                <th className="text-left px-6 py-3 font-semibold text-slate-600">
                  Referral Bonus
                </th>
              </tr>
            </thead>
            <tbody>
              {adjustments.map((adj, i) => (
                <tr
                  key={i}
                  className="border-b border-border hover:bg-slate-50/50 transition-colors"
                >
                  <td className="px-6 py-4 font-medium text-foreground whitespace-nowrap">
                    {adj.effectivityDate}
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center gap-1">
                      {adj.type.includes("PROMOTED") ||
                      adj.type.includes("HIRED") ? (
                        <ArrowUpRight
                          size={14}
                          className="text-emerald-500"
                        />
                      ) : (
                        <TrendingUp size={14} className="text-blue-500" />
                      )}
                      <span className="text-foreground">{adj.type}</span>
                    </span>
                  </td>
                  <td className="px-6 py-4 font-semibold text-emerald-600">
                    {adj.hourlyRate}
                  </td>
                  <td className="px-6 py-4 text-foreground">
                    {adj.salesCommission}
                  </td>
                  <td className="px-6 py-4 text-foreground">
                    {adj.referralBonus}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <h3 className="font-semibold text-blue-800 mb-2">
          Salary History Timeline
        </h3>
        <div className="space-y-3">
          {adjustments.map((adj, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="w-3 h-3 bg-blue-500 rounded-full mt-1.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-blue-900">
                  {adj.effectivityDate} &mdash; {adj.type}
                </p>
                <p className="text-xs text-blue-700">{adj.notes}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
