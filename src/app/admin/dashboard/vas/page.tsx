"use client";

import { useState } from "react";
import { vaProfiles, getAdjustments, getInvoices, getLeaveRequests } from "@/lib/data";
import { Users, Eye, X, Mail, Phone, MapPin, Briefcase } from "lucide-react";

export default function VAManagementPage() {
  const [selectedVA, setSelectedVA] = useState<string | null>(null);

  const profile = selectedVA ? vaProfiles.find((v) => v.id === selectedVA) : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">VA Management</h1>
        <span className="text-sm text-muted">{vaProfiles.length} active VAs</span>
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
              {vaProfiles.map((va) => {
                const adjCount = getAdjustments(va.id).length;
                const invCount = getInvoices(va.id).filter((i) => i.invoiceNumber && i.amount).length;
                const reqCount = getLeaveRequests(va.id).length;
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
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
                        {va.position}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-foreground">{va.email}</td>
                    <td className="px-6 py-4 text-foreground">{va.dateHired}</td>
                    <td className="px-6 py-4 font-medium text-foreground">{va.currentRate}</td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => setSelectedVA(va.id)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors"
                      >
                        <Eye size={14} />
                        View
                      </button>
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
                <Users size={20} className="text-indigo-600" />
                VA Profile - {profile.id}
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
                  <h3 className="text-lg font-semibold text-slate-900">
                    {profile.firstName} {profile.middleName} {profile.lastName} {profile.suffix}
                  </h3>
                  <p className="text-sm text-slate-500">{profile.position}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-start gap-2">
                  <Mail size={16} className="text-slate-400 mt-0.5" />
                  <div>
                    <p className="text-slate-500">Email</p>
                    <p className="font-medium text-slate-900">{profile.email}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Phone size={16} className="text-slate-400 mt-0.5" />
                  <div>
                    <p className="text-slate-500">Phone</p>
                    <p className="font-medium text-slate-900">{profile.phone}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Briefcase size={16} className="text-slate-400 mt-0.5" />
                  <div>
                    <p className="text-slate-500">Date Hired</p>
                    <p className="font-medium text-slate-900">{profile.dateHired}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Briefcase size={16} className="text-slate-400 mt-0.5" />
                  <div>
                    <p className="text-slate-500">Current Rate</p>
                    <p className="font-medium text-slate-900">{profile.currentRate}</p>
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-2 text-sm pt-2 border-t border-slate-100">
                <MapPin size={16} className="text-slate-400 mt-0.5" />
                <div>
                  <p className="text-slate-500">Permanent Address</p>
                  <p className="font-medium text-slate-900">
                    {profile.permanentAddress.street}, {profile.permanentAddress.subdivision}, {profile.permanentAddress.barangay}, {profile.permanentAddress.city}, {profile.permanentAddress.province} {profile.permanentAddress.postalCode}
                  </p>
                </div>
              </div>

              <div className="text-sm pt-2 border-t border-slate-100">
                <p className="text-slate-500">Emergency Contact</p>
                <p className="font-medium text-slate-900">{profile.emergencyContact} - {profile.emergencyPhone}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
