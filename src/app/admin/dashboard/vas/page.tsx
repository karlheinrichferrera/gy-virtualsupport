"use client";

import { useState, useEffect } from "react";
import * as store from "@/lib/store";
import type { VAProfile } from "@/lib/data";
import { Users, Eye, X, Mail, Phone, MapPin, Briefcase, Plus, Trash2, AlertTriangle } from "lucide-react";

export default function VAManagementPage() {
  const [vas, setVAs] = useState<VAProfile[]>([]);
  const [selectedVA, setSelectedVA] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [form, setForm] = useState({
    id: "", firstName: "", middleName: "", lastName: "", suffix: "",
    phone: "", altPhone: "", email: "", street: "", subdivision: "",
    barangay: "", city: "", province: "", postalCode: "",
    temporaryAddress: "", position: "Telemarketer", dateHired: "",
    currentRate: "", emergencyContact: "", emergencyPhone: "",
  });

  useEffect(() => { setVAs(store.getProfiles()); }, []);

  const profile = selectedVA ? vas.find((v) => v.id === selectedVA) : null;

  function generateNextId() {
    const ids = vas.map((v) => parseInt(v.id));
    return String(Math.max(...ids, 500100) + 1);
  }

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const newVA: VAProfile = {
      id: form.id || generateNextId(),
      firstName: form.firstName, middleName: form.middleName,
      lastName: form.lastName, suffix: form.suffix,
      phone: form.phone, altPhone: form.altPhone || "N/A",
      email: form.email,
      permanentAddress: {
        street: form.street, subdivision: form.subdivision,
        barangay: form.barangay, city: form.city,
        province: form.province, postalCode: form.postalCode,
      },
      temporaryAddress: form.temporaryAddress || "Same as permanent address",
      position: form.position,
      dateHired: form.dateHired || new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
      currentRate: form.currentRate,
      emergencyContact: form.emergencyContact,
      emergencyPhone: form.emergencyPhone,
    };
    store.addProfile(newVA);
    setVAs(store.getProfiles());
    setShowCreate(false);
    setForm({
      id: "", firstName: "", middleName: "", lastName: "", suffix: "",
      phone: "", altPhone: "", email: "", street: "", subdivision: "",
      barangay: "", city: "", province: "", postalCode: "",
      temporaryAddress: "", position: "Telemarketer", dateHired: "",
      currentRate: "", emergencyContact: "", emergencyPhone: "",
    });
  }

  function handleDelete(id: string) {
    store.deleteProfile(id);
    setVAs(store.getProfiles());
    setDeleteTarget(null);
  }

  const inputClass = "w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">VA Management</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted">{vas.length} active VAs</span>
          <button
            onClick={() => { setForm((f) => ({ ...f, id: generateNextId() })); setShowCreate(true); }}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
          >
            <Plus size={16} /> Create VA
          </button>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-border">
                <th className="text-left px-6 py-3 font-semibold text-slate-600">VA ID</th>
                <th className="text-left px-6 py-3 font-semibold text-slate-600">Name</th>
                <th className="text-left px-6 py-3 font-semibold text-slate-600">Position</th>
                <th className="text-left px-6 py-3 font-semibold text-slate-600">Email</th>
                <th className="text-left px-6 py-3 font-semibold text-slate-600">Date Hired</th>
                <th className="text-left px-6 py-3 font-semibold text-slate-600">Rate</th>
                <th className="text-center px-6 py-3 font-semibold text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {vas.map((va) => {
                const adjCount = store.getAdjustmentsFor(va.id).length;
                const invCount = store.getInvoicesFor(va.id).filter((i) => i.invoiceNumber && i.amount).length;
                const reqCount = store.getRequestsFor(va.id).length;
                return (
                  <tr key={va.id} className="border-b border-border hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 font-mono font-medium text-foreground">{va.id}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold">
                          {va.firstName.charAt(0)}{va.lastName.charAt(0)}
                        </div>
                        <div>
                          <p className="font-medium text-foreground">
                            {va.firstName} {va.middleName ? va.middleName.charAt(0) + ". " : ""}{va.lastName}{va.suffix ? ` ${va.suffix}` : ""}
                          </p>
                          <p className="text-xs text-muted">{adjCount} adj / {invCount} inv / {reqCount} req</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">{va.position}</span>
                    </td>
                    <td className="px-6 py-4 text-foreground">{va.email}</td>
                    <td className="px-6 py-4 text-foreground">{va.dateHired}</td>
                    <td className="px-6 py-4 font-medium text-foreground">{va.currentRate}</td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => setSelectedVA(va.id)} className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors">
                          <Eye size={14} /> View
                        </button>
                        <button onClick={() => setDeleteTarget(va.id)} className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors">
                          <Trash2 size={14} /> Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {profile && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 sticky top-0 bg-white rounded-t-2xl">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Users size={20} className="text-indigo-600" /> VA Profile - {profile.id}
              </h2>
              <button onClick={() => setSelectedVA(null)} className="p-1 hover:bg-slate-100 rounded-lg">
                <X size={20} className="text-slate-500" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-4 pb-4 border-b border-slate-100">
                <div className="w-14 h-14 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xl font-bold">
                  {profile.firstName.charAt(0)}{profile.lastName.charAt(0)}
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">{profile.firstName} {profile.middleName} {profile.lastName} {profile.suffix}</h3>
                  <p className="text-sm text-slate-500">{profile.position}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-start gap-2"><Mail size={16} className="text-slate-400 mt-0.5" /><div><p className="text-slate-500">Email</p><p className="font-medium text-slate-900">{profile.email}</p></div></div>
                <div className="flex items-start gap-2"><Phone size={16} className="text-slate-400 mt-0.5" /><div><p className="text-slate-500">Phone</p><p className="font-medium text-slate-900">{profile.phone}</p></div></div>
                <div className="flex items-start gap-2"><Briefcase size={16} className="text-slate-400 mt-0.5" /><div><p className="text-slate-500">Date Hired</p><p className="font-medium text-slate-900">{profile.dateHired}</p></div></div>
                <div className="flex items-start gap-2"><Briefcase size={16} className="text-slate-400 mt-0.5" /><div><p className="text-slate-500">Current Rate</p><p className="font-medium text-slate-900">{profile.currentRate}</p></div></div>
              </div>
              <div className="flex items-start gap-2 text-sm pt-2 border-t border-slate-100">
                <MapPin size={16} className="text-slate-400 mt-0.5" />
                <div><p className="text-slate-500">Permanent Address</p><p className="font-medium text-slate-900">{profile.permanentAddress.street}, {profile.permanentAddress.subdivision}, {profile.permanentAddress.barangay}, {profile.permanentAddress.city}, {profile.permanentAddress.province} {profile.permanentAddress.postalCode}</p></div>
              </div>
              <div className="text-sm pt-2 border-t border-slate-100">
                <p className="text-slate-500">Emergency Contact</p>
                <p className="font-medium text-slate-900">{profile.emergencyContact} - {profile.emergencyPhone}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="p-6 text-center space-y-4">
              <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto"><AlertTriangle className="text-red-600" size={28} /></div>
              <h3 className="text-lg font-bold text-slate-900">Delete VA Account</h3>
              <p className="text-sm text-slate-600">
                Are you sure you want to delete VA <strong>{deleteTarget}</strong> ({vas.find((v) => v.id === deleteTarget)?.firstName} {vas.find((v) => v.id === deleteTarget)?.lastName})? This action cannot be undone.
              </p>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setDeleteTarget(null)} className="flex-1 border border-slate-300 text-slate-700 font-medium py-2.5 rounded-lg hover:bg-slate-50 transition-colors text-sm">Cancel</button>
                <button onClick={() => handleDelete(deleteTarget)} className="flex-1 bg-red-600 hover:bg-red-700 text-white font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm">
                  <Trash2 size={16} /> Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 sticky top-0 bg-white rounded-t-2xl z-10">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2"><Plus size={20} className="text-indigo-600" /> Create New VA Account</h2>
              <button onClick={() => setShowCreate(false)} className="p-1 hover:bg-slate-100 rounded-lg"><X size={20} className="text-slate-500" /></button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-5">
              <div>
                <h3 className="text-sm font-semibold text-slate-800 mb-3 pb-2 border-b border-slate-100">Personal Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-xs font-medium text-slate-600 mb-1">VA ID</label><input type="text" value={form.id} onChange={(e) => setForm((f) => ({ ...f, id: e.target.value }))} className={inputClass} placeholder="Auto-generated" /></div>
                  <div><label className="block text-xs font-medium text-slate-600 mb-1">Position</label><select value={form.position} onChange={(e) => setForm((f) => ({ ...f, position: e.target.value }))} className={inputClass}><option>Telemarketer</option><option>Sales Support</option><option>Operations Support</option><option>Admin Support</option><option>Customer Service</option></select></div>
                  <div><label className="block text-xs font-medium text-slate-600 mb-1">First Name *</label><input type="text" required value={form.firstName} onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))} className={inputClass} /></div>
                  <div><label className="block text-xs font-medium text-slate-600 mb-1">Middle Name</label><input type="text" value={form.middleName} onChange={(e) => setForm((f) => ({ ...f, middleName: e.target.value }))} className={inputClass} /></div>
                  <div><label className="block text-xs font-medium text-slate-600 mb-1">Last Name *</label><input type="text" required value={form.lastName} onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))} className={inputClass} /></div>
                  <div><label className="block text-xs font-medium text-slate-600 mb-1">Suffix</label><input type="text" value={form.suffix} onChange={(e) => setForm((f) => ({ ...f, suffix: e.target.value }))} className={inputClass} placeholder="Jr., Sr., III" /></div>
                </div>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-800 mb-3 pb-2 border-b border-slate-100">Contact Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-xs font-medium text-slate-600 mb-1">Email *</label><input type="email" required value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className={inputClass} /></div>
                  <div><label className="block text-xs font-medium text-slate-600 mb-1">Phone *</label><input type="text" required value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} className={inputClass} placeholder="(+63) 9XX XXX XXXX" /></div>
                  <div className="col-span-2"><label className="block text-xs font-medium text-slate-600 mb-1">Alt Phone</label><input type="text" value={form.altPhone} onChange={(e) => setForm((f) => ({ ...f, altPhone: e.target.value }))} className={inputClass} placeholder="N/A" /></div>
                </div>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-800 mb-3 pb-2 border-b border-slate-100">Permanent Address</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-xs font-medium text-slate-600 mb-1">Street *</label><input type="text" required value={form.street} onChange={(e) => setForm((f) => ({ ...f, street: e.target.value }))} className={inputClass} /></div>
                  <div><label className="block text-xs font-medium text-slate-600 mb-1">Subdivision</label><input type="text" value={form.subdivision} onChange={(e) => setForm((f) => ({ ...f, subdivision: e.target.value }))} className={inputClass} /></div>
                  <div><label className="block text-xs font-medium text-slate-600 mb-1">Barangay *</label><input type="text" required value={form.barangay} onChange={(e) => setForm((f) => ({ ...f, barangay: e.target.value }))} className={inputClass} /></div>
                  <div><label className="block text-xs font-medium text-slate-600 mb-1">City *</label><input type="text" required value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} className={inputClass} /></div>
                  <div><label className="block text-xs font-medium text-slate-600 mb-1">Province *</label><input type="text" required value={form.province} onChange={(e) => setForm((f) => ({ ...f, province: e.target.value }))} className={inputClass} /></div>
                  <div><label className="block text-xs font-medium text-slate-600 mb-1">Postal Code</label><input type="text" value={form.postalCode} onChange={(e) => setForm((f) => ({ ...f, postalCode: e.target.value }))} className={inputClass} /></div>
                  <div className="col-span-2"><label className="block text-xs font-medium text-slate-600 mb-1">Temporary Address</label><input type="text" value={form.temporaryAddress} onChange={(e) => setForm((f) => ({ ...f, temporaryAddress: e.target.value }))} className={inputClass} placeholder="Same as permanent address" /></div>
                </div>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-800 mb-3 pb-2 border-b border-slate-100">Employment & Emergency</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-xs font-medium text-slate-600 mb-1">Date Hired</label><input type="text" value={form.dateHired} onChange={(e) => setForm((f) => ({ ...f, dateHired: e.target.value }))} className={inputClass} placeholder="e.g. October 07, 2026" /></div>
                  <div><label className="block text-xs font-medium text-slate-600 mb-1">Hourly Rate *</label><input type="text" required value={form.currentRate} onChange={(e) => setForm((f) => ({ ...f, currentRate: e.target.value }))} className={inputClass} placeholder="$X.XX / Hour" /></div>
                  <div><label className="block text-xs font-medium text-slate-600 mb-1">Emergency Contact *</label><input type="text" required value={form.emergencyContact} onChange={(e) => setForm((f) => ({ ...f, emergencyContact: e.target.value }))} className={inputClass} /></div>
                  <div><label className="block text-xs font-medium text-slate-600 mb-1">Emergency Phone *</label><input type="text" required value={form.emergencyPhone} onChange={(e) => setForm((f) => ({ ...f, emergencyPhone: e.target.value }))} className={inputClass} /></div>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowCreate(false)} className="flex-1 border border-slate-300 text-slate-700 font-medium py-2.5 rounded-lg hover:bg-slate-50 transition-colors">Cancel</button>
                <button type="submit" className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2"><Plus size={16} /> Create VA Account</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
