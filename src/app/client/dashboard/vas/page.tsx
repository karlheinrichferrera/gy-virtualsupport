"use client";

import { useState, useEffect } from "react";
import * as actions from "@/lib/actions";
import type { VAProfile } from "@/lib/data";
type VAWithClientRate = VAProfile & { clientRate: string };
import { Users, Eye, X, Mail, Phone, Briefcase, MapPin } from "lucide-react";

export default function ClientVAsPage() {
  const [vas, setVAs] = useState<VAWithClientRate[]>([]);
  const [selectedVA, setSelectedVA] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const email = localStorage.getItem("clientEmail") || "";
      const profiles = await actions.getVAsByClientEmail(email);
      setVAs(profiles);
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

  const profile = selectedVA ? vas.find((v) => v.id === selectedVA) : null;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
        <Users size={24} />
        My Virtual Assistants
      </h1>

      {vas.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-8 text-center">
          <Users size={48} className="mx-auto text-slate-300 mb-4" />
          <p className="text-slate-500">No VAs have been assigned to your account yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {vas.map((va) => (
            <div key={va.id} className="bg-card border border-border rounded-xl p-5 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-lg font-bold">
                  {va.firstName.charAt(0)}{va.lastName.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-foreground truncate">
                    {va.firstName} {va.middleName ? va.middleName.charAt(0) + ". " : ""}{va.lastName}{va.suffix ? ` ${va.suffix}` : ""}
                  </h3>
                  <p className="text-xs text-muted">ID: {va.id}</p>
                </div>
              </div>
              <div className="space-y-1.5 text-sm mb-4">
                <div className="flex flex-wrap gap-1">
                  {va.position.split(",").map((p) => p.trim()).filter(Boolean).map((p) => (
                    <span key={p} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">{p}</span>
                  ))}
                </div>
                <p className="text-muted flex items-center gap-1.5"><Mail size={14} /> {va.email}</p>
                <p className="text-muted flex items-center gap-1.5"><Phone size={14} /> {va.phone}</p>
              </div>
              <button
                onClick={() => setSelectedVA(va.id)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-emerald-600 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors"
              >
                <Eye size={16} /> View Full Profile
              </button>
            </div>
          ))}
        </div>
      )}

      {profile && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 sticky top-0 bg-white rounded-t-2xl">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Users size={20} className="text-emerald-600" /> VA Profile
              </h2>
              <button onClick={() => setSelectedVA(null)} className="p-1 hover:bg-slate-100 rounded-lg">
                <X size={20} className="text-slate-500" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-4 pb-4 border-b border-slate-100">
                <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xl font-bold">
                  {profile.firstName.charAt(0)}{profile.lastName.charAt(0)}
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">
                    {profile.firstName} {profile.middleName} {profile.lastName} {profile.suffix}
                  </h3>
                  <p className="text-sm text-slate-500">VA ID: {profile.id}</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {profile.position.split(",").map((p) => p.trim()).filter(Boolean).map((p) => (
                      <span key={p} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">{p}</span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-start gap-2">
                  <Mail size={16} className="text-slate-400 mt-0.5" />
                  <div><p className="text-slate-500">Email</p><p className="font-medium text-slate-900">{profile.email}</p></div>
                </div>
                <div className="flex items-start gap-2">
                  <Phone size={16} className="text-slate-400 mt-0.5" />
                  <div><p className="text-slate-500">Phone</p><p className="font-medium text-slate-900">{profile.phone}</p></div>
                </div>
                <div className="flex items-start gap-2">
                  <Briefcase size={16} className="text-slate-400 mt-0.5" />
                  <div><p className="text-slate-500">Status</p><p className="font-medium text-slate-900">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      profile.employmentStatus === "Regular Hire" ? "bg-emerald-100 text-emerald-700" :
                      profile.employmentStatus === "Probationary Hire" ? "bg-amber-100 text-amber-700" :
                      profile.employmentStatus === "Seasonal / Contractual Hire" ? "bg-blue-100 text-blue-700" :
                      "bg-slate-100 text-slate-600"
                    }`}>{profile.employmentStatus || "N/A"}</span>
                  </p></div>
                </div>
                <div className="flex items-start gap-2">
                  <Briefcase size={16} className="text-slate-400 mt-0.5" />
                  <div><p className="text-slate-500">Date Hired</p><p className="font-medium text-slate-900">{profile.dateHired}</p></div>
                </div>
                <div className="flex items-start gap-2">
                  <Briefcase size={16} className="text-slate-400 mt-0.5" />
                  <div><p className="text-slate-500">Rate</p><p className="font-medium text-slate-900">{profile.clientRate || "N/A"}</p></div>
                </div>
              </div>

              <div className="flex items-start gap-2 text-sm pt-2 border-t border-slate-100">
                <MapPin size={16} className="text-slate-400 mt-0.5" />
                <div>
                  <p className="text-slate-500">Location</p>
                  <p className="font-medium text-slate-900">{profile.permanentAddress.city}, {profile.permanentAddress.province}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
