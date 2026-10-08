"use client";

import { useState, useEffect } from "react";
import * as actions from "@/lib/actions";
import type { ClientSalaryAdjustment } from "@/lib/actions";
import type { VAProfile } from "@/lib/data";
import { DollarSign, Plus, X, Trash2, AlertTriangle } from "lucide-react";

const inputClass = "w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900";

export default function ClientAdjustmentsPage() {
  const [vaProfiles, setVaProfiles] = useState<VAProfile[]>([]);
  const [selectedVA, setSelectedVA] = useState("");
  const [adjustments, setAdjustments] = useState<ClientSalaryAdjustment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const [form, setForm] = useState({ effectivityDate: "", type: "INCREASE", hourlyRate: "", salesCommission: "", referralBonus: "", notes: "" });

  async function loadData() {
    const email = localStorage.getItem("clientEmail") || "";
    const [profiles, adjs] = await Promise.all([
      actions.getProfiles(),
      actions.getClientSalaryAdjustmentsByEmail(email),
    ]);
    setVaProfiles(profiles);
    setAdjustments(adjs);
    if (!selectedVA && profiles.length > 0) setSelectedVA(profiles[0].id);
    setLoading(false);
  }

  useEffect(() => { loadData(); }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const email = localStorage.getItem("clientEmail") || "";
    const acc = await actions.getClientAccountByEmail(email);
    if (!acc) return;
    await actions.addClientSalaryAdjustment({
      clientId: acc.id,
      vaId: selectedVA,
      effectivityDate: form.effectivityDate,
      type: form.type,
      hourlyRate: form.hourlyRate,
      salesCommission: form.salesCommission,
      referralBonus: form.referralBonus,
      notes: form.notes,
    });
    setShowAdd(false);
    setForm({ effectivityDate: "", type: "INCREASE", hourlyRate: "", salesCommission: "", referralBonus: "", notes: "" });
    await loadData();
  }

  async function handleDelete() {
    if (deleteTarget === null) return;
    await actions.deleteClientSalaryAdjustment(deleteTarget);
    setDeleteTarget(null);
    await loadData();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
      </div>
    );
  }

  const currentAdj = adjustments.filter((a) => a.vaId === selectedVA);
  const selectedProfile = vaProfiles.find((v) => v.id === selectedVA);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <DollarSign size={24} />
          Salary Adjustments
        </h1>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors">
          <Plus size={16} /> Add Adjustment
        </button>
      </div>

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
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Actions</th>
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
                    <td className="px-4 py-3">
                      <button onClick={() => setDeleteTarget(adj.id)} className="p-1.5 hover:bg-red-50 rounded-lg" title="Delete">
                        <Trash2 size={14} className="text-red-600" />
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
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2"><Plus size={20} className="text-emerald-600" /> Add Salary Adjustment</h2>
              <button onClick={() => setShowAdd(false)} className="p-1 hover:bg-slate-100 rounded-lg"><X size={20} className="text-slate-500" /></button>
            </div>
            <form onSubmit={handleAdd} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">VA</label>
                <select value={selectedVA} onChange={(e) => setSelectedVA(e.target.value)} className={inputClass}>
                  {vaProfiles.map((va) => (
                    <option key={va.id} value={va.id}>{va.id} - {va.firstName} {va.lastName}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-xs font-medium text-slate-600 mb-1">Effectivity Date *</label><input type="text" required value={form.effectivityDate} onChange={(e) => setForm((f) => ({ ...f, effectivityDate: e.target.value }))} className={inputClass} placeholder="e.g. October 1, 2026" /></div>
                <div><label className="block text-xs font-medium text-slate-600 mb-1">Type *</label>
                  <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))} className={inputClass}>
                    <option value="INCREASE">INCREASE</option>
                    <option value="DECREASE">DECREASE</option>
                    <option value="BONUS">BONUS</option>
                    <option value="INITIAL">INITIAL</option>
                  </select>
                </div>
                <div><label className="block text-xs font-medium text-slate-600 mb-1">Hourly Rate</label><input type="text" value={form.hourlyRate} onChange={(e) => setForm((f) => ({ ...f, hourlyRate: e.target.value }))} className={inputClass} placeholder="e.g. $5.00" /></div>
                <div><label className="block text-xs font-medium text-slate-600 mb-1">Sales Commission</label><input type="text" value={form.salesCommission} onChange={(e) => setForm((f) => ({ ...f, salesCommission: e.target.value }))} className={inputClass} placeholder="e.g. 5%" /></div>
                <div><label className="block text-xs font-medium text-slate-600 mb-1">Referral Bonus</label><input type="text" value={form.referralBonus} onChange={(e) => setForm((f) => ({ ...f, referralBonus: e.target.value }))} className={inputClass} placeholder="e.g. $50" /></div>
                <div className="col-span-2"><label className="block text-xs font-medium text-slate-600 mb-1">Notes</label><input type="text" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} className={inputClass} placeholder="Optional notes" /></div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowAdd(false)} className="flex-1 border border-slate-300 text-slate-700 font-medium py-2.5 rounded-lg hover:bg-slate-50">Cancel</button>
                <button type="submit" className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2.5 rounded-lg flex items-center justify-center gap-2"><Plus size={16} /> Add</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteTarget !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="p-6 text-center space-y-4">
              <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto"><AlertTriangle className="text-red-600" size={28} /></div>
              <h3 className="text-lg font-bold text-slate-900">Delete Adjustment?</h3>
              <p className="text-sm text-slate-500">This action cannot be undone.</p>
              <div className="flex gap-3">
                <button onClick={() => setDeleteTarget(null)} className="flex-1 border border-slate-300 text-slate-700 font-medium py-2.5 rounded-lg hover:bg-slate-50">Cancel</button>
                <button onClick={handleDelete} className="flex-1 bg-red-600 hover:bg-red-700 text-white font-medium py-2.5 rounded-lg">Delete</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
