"use client";

import { useState, useEffect } from "react";
import * as store from "@/lib/store";
import type { VAProfile, SalaryAdjustment } from "@/lib/data";
import { DollarSign, Plus, X, Trash2, AlertTriangle } from "lucide-react";

export default function AdminAdjustmentsPage() {
  const [vaProfiles, setVaProfiles] = useState<VAProfile[]>([]);
  const [selectedVA, setSelectedVA] = useState("");
  const [adjustments, setAdjustments] = useState<Record<string, SalaryAdjustment[]>>({});
  const [showAdd, setShowAdd] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ vaId: string; idx: number } | null>(null);
  const [form, setForm] = useState({
    effectivityDate: "",
    type: "",
    hourlyRate: "",
    salesCommission: "",
    referralBonus: "",
    notes: "",
  });

  useEffect(() => {
    const profiles = store.getProfiles();
    setVaProfiles(profiles);
    setSelectedVA(profiles[0]?.id || "");
    setAdjustments(store.getAllAdjustments());
  }, []);

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const newAdj: SalaryAdjustment = {
      effectivityDate: form.effectivityDate,
      type: form.type.toUpperCase(),
      hourlyRate: form.hourlyRate,
      salesCommission: form.salesCommission || "No Adjustment",
      referralBonus: form.referralBonus || "No Adjustment",
      notes: form.notes,
    };
    store.addAdjustment(selectedVA, newAdj);
    setAdjustments(store.getAllAdjustments());
    setShowAdd(false);
    setForm({ effectivityDate: "", type: "", hourlyRate: "", salesCommission: "", referralBonus: "", notes: "" });
  }

  function handleDelete(vaId: string, idx: number) {
    const all = { ...adjustments };
    const list = [...(all[vaId] || [])];
    list.splice(idx, 1);
    all[vaId] = list;
    store.saveAllAdjustments(all);
    setAdjustments(store.getAllAdjustments());
    setDeleteTarget(null);
  }

  const currentAdj = adjustments[selectedVA] || [];
  const currentVA = vaProfiles.find((v) => v.id === selectedVA);
  const inputClass = "w-full px-4 py-2.5 rounded-lg border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Salary Adjustments</h1>
        <button
          onClick={() => setShowAdd(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
        >
          <Plus size={16} />
          Add Adjustment
        </button>
      </div>

      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-foreground">Select VA:</label>
        <select
          value={selectedVA}
          onChange={(e) => setSelectedVA(e.target.value)}
          className="px-4 py-2 rounded-lg border border-border bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {vaProfiles.map((va) => (
            <option key={va.id} value={va.id}>
              {va.firstName} {va.lastName} ({va.id})
            </option>
          ))}
        </select>
        {currentVA && (
          <span className="text-sm bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full font-medium">
            Current: {currentVA.currentRate}
          </span>
        )}
      </div>

      {currentAdj.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-12 text-center">
          <DollarSign size={48} className="text-muted mx-auto mb-4" />
          <p className="text-lg font-medium text-foreground">No salary adjustments</p>
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-border">
                  <th className="text-left px-6 py-3 font-semibold text-slate-600">#</th>
                  <th className="text-left px-6 py-3 font-semibold text-slate-600">Effectivity Date</th>
                  <th className="text-left px-6 py-3 font-semibold text-slate-600">Type</th>
                  <th className="text-left px-6 py-3 font-semibold text-slate-600">Hourly Rate</th>
                  <th className="text-left px-6 py-3 font-semibold text-slate-600">Sales Commission</th>
                  <th className="text-left px-6 py-3 font-semibold text-slate-600">Referral Bonus</th>
                  <th className="text-left px-6 py-3 font-semibold text-slate-600">Notes</th>
                  <th className="text-center px-6 py-3 font-semibold text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {currentAdj.map((adj, idx) => (
                  <tr key={idx} className="border-b border-border hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 text-muted">{idx + 1}</td>
                    <td className="px-6 py-4 font-medium text-foreground">{adj.effectivityDate}</td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-700">
                        {adj.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-medium text-foreground">{adj.hourlyRate}</td>
                    <td className="px-6 py-4 text-foreground">{adj.salesCommission}</td>
                    <td className="px-6 py-4 text-foreground">{adj.referralBonus}</td>
                    <td className="px-6 py-4 text-muted">{adj.notes}</td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => setDeleteTarget({ vaId: selectedVA, idx })}
                        className="p-1.5 rounded hover:bg-slate-100 text-slate-500 hover:text-red-600 transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showAdd && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <DollarSign size={20} className="text-indigo-600" />
                New Salary Adjustment
              </h2>
              <button onClick={() => setShowAdd(false)} className="p-1 hover:bg-slate-100 rounded-lg">
                <X size={20} className="text-slate-500" />
              </button>
            </div>
            <form onSubmit={handleAdd} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">VA</label>
                <select value={selectedVA} onChange={(e) => setSelectedVA(e.target.value)} className={inputClass}>
                  {vaProfiles.map((va) => (
                    <option key={va.id} value={va.id}>{va.firstName} {va.lastName} ({va.id})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Effectivity Date</label>
                <input type="text" required value={form.effectivityDate} onChange={(e) => setForm((f) => ({ ...f, effectivityDate: e.target.value }))} className={inputClass} placeholder="e.g. October 07, 2026" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
                <input type="text" required value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))} className={inputClass} placeholder="e.g. Salary Adjustment" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Hourly Rate</label>
                <input type="text" required value={form.hourlyRate} onChange={(e) => setForm((f) => ({ ...f, hourlyRate: e.target.value }))} className={inputClass} placeholder="e.g. $5.50 / Hour" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Sales Commission</label>
                  <input type="text" value={form.salesCommission} onChange={(e) => setForm((f) => ({ ...f, salesCommission: e.target.value }))} className={inputClass} placeholder="No Adjustment" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Referral Bonus</label>
                  <input type="text" value={form.referralBonus} onChange={(e) => setForm((f) => ({ ...f, referralBonus: e.target.value }))} className={inputClass} placeholder="No Adjustment" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                <input type="text" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} className={inputClass} placeholder="Optional notes" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowAdd(false)} className="flex-1 border border-slate-300 text-slate-700 font-medium py-2.5 rounded-lg hover:bg-slate-50 transition-colors">Cancel</button>
                <button type="submit" className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 rounded-lg transition-colors">Add Adjustment</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="p-6 text-center space-y-4">
              <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto">
                <AlertTriangle className="text-red-600" size={28} />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Delete Adjustment</h3>
              <p className="text-sm text-slate-600">
                Are you sure you want to delete this salary adjustment? This action cannot be undone.
              </p>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setDeleteTarget(null)} className="flex-1 border border-slate-300 text-slate-700 font-medium py-2.5 rounded-lg hover:bg-slate-50 transition-colors text-sm">Cancel</button>
                <button onClick={() => handleDelete(deleteTarget.vaId, deleteTarget.idx)} className="flex-1 bg-red-600 hover:bg-red-700 text-white font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm">
                  <Trash2 size={16} /> Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
