"use client";

import React, { useState, useEffect } from "react";
import * as actions from "@/lib/actions";
import type { VAProfile } from "@/lib/data";
import { Users, Eye, X, Mail, Phone, MapPin, Briefcase, Plus, Trash2, AlertTriangle, KeyRound, Pencil, Save, CreditCard, Heart, Download, Wallet, SlidersHorizontal, Check, ClipboardList } from "lucide-react";

const POSITION_OPTIONS = ["Telemarketer", "Sales Support", "Operations Support", "Admin Support", "Customer Service", "Marketing Support", "Video Editor", "Graphics Designer", "GHL Specialist"];
const EMPLOYMENT_STATUS_OPTIONS = ["Probationary Hire", "Seasonal / Contractual Hire", "Regular Hire", "Terminated", "Resigned"];
const PAYOUT_MODE_OPTIONS = ["Paypal", "Wise", "Bank Transfer", "Ewallet"];
const EWALLET_NAME_OPTIONS = ["Gcash", "Maya", "Maribank", "GoTyme"];

type ColumnDef = {
  key: string;
  label: string;
  defaultVisible: boolean;
  render: (va: VAProfile) => React.ReactNode;
};

const ALL_COLUMNS: ColumnDef[] = [
  { key: "id", label: "VA ID", defaultVisible: true, render: (va) => <span className="font-mono font-medium text-foreground">{va.id}</span> },
  { key: "name", label: "Name", defaultVisible: true, render: (va) => (
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold">{va.firstName.charAt(0)}{va.lastName.charAt(0)}</div>
      <p className="font-medium text-foreground">{va.firstName} {va.middleName ? va.middleName.charAt(0) + ". " : ""}{va.lastName}{va.suffix ? ` ${va.suffix}` : ""}</p>
    </div>
  )},
  { key: "position", label: "Position", defaultVisible: true, render: (va) => <PositionBadges position={va.position} /> },
  { key: "status", label: "Status", defaultVisible: true, render: (va) => (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
      va.employmentStatus === "Regular Hire" ? "bg-emerald-100 text-emerald-700" :
      va.employmentStatus === "Probationary Hire" ? "bg-amber-100 text-amber-700" :
      va.employmentStatus === "Seasonal / Contractual Hire" ? "bg-blue-100 text-blue-700" :
      va.employmentStatus === "Terminated" ? "bg-red-100 text-red-700" :
      va.employmentStatus === "Resigned" ? "bg-slate-100 text-slate-600" :
      "bg-slate-100 text-slate-600"
    }`}>{va.employmentStatus || "N/A"}</span>
  )},
  { key: "email", label: "Email", defaultVisible: true, render: (va) => <span className="text-foreground">{va.email}</span> },
  { key: "dateHired", label: "Date Hired", defaultVisible: true, render: (va) => <span className="text-foreground">{va.dateHired}</span> },
  { key: "rate", label: "Rate", defaultVisible: true, render: (va) => <span className="font-medium text-foreground">{va.currentRate}</span> },
  { key: "dob", label: "Date of Birth", defaultVisible: false, render: (va) => <span className="text-foreground">{va.dateOfBirth || "N/A"}</span> },
  { key: "phone", label: "Phone", defaultVisible: false, render: (va) => <span className="text-foreground">{va.phone}</span> },
  { key: "altPhone", label: "Alt Phone", defaultVisible: false, render: (va) => <span className="text-foreground">{va.altPhone || "N/A"}</span> },
  { key: "contractorId", label: "Contractor ID", defaultVisible: false, render: (va) => <span className="text-foreground">{va.contractorId || "N/A"}</span> },
  { key: "payoutMode", label: "Payout Mode", defaultVisible: false, render: (va) => <span className="text-foreground">{va.payoutMode || "N/A"}</span> },
  { key: "emergencyContact", label: "Emergency Contact", defaultVisible: false, render: (va) => <span className="text-foreground">{va.emergencyContact || "N/A"}</span> },
  { key: "emergencyPhone", label: "Emergency Phone", defaultVisible: false, render: (va) => <span className="text-foreground">{va.emergencyPhone || "N/A"}</span> },
  { key: "address", label: "Address", defaultVisible: false, render: (va) => <span className="text-foreground text-xs">{va.permanentAddress.city}, {va.permanentAddress.province}</span> },
];

const STORAGE_KEY = "admin-va-columns";

function loadColumnVisibility(): Record<string, boolean> {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  const defaults: Record<string, boolean> = {};
  ALL_COLUMNS.forEach((c) => { defaults[c.key] = c.defaultVisible; });
  return defaults;
}

function PositionMultiSelect({ selected, onChange }: { selected: string[]; onChange: (v: string[]) => void }) {
  function toggle(pos: string) {
    onChange(selected.includes(pos) ? selected.filter((p) => p !== pos) : [...selected, pos]);
  }
  return (
    <div className="flex flex-wrap gap-2">
      {POSITION_OPTIONS.map((pos) => (
        <button
          key={pos}
          type="button"
          onClick={() => toggle(pos)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
            selected.includes(pos)
              ? "bg-indigo-600 text-white border-indigo-600"
              : "bg-white text-slate-600 border-slate-300 hover:border-indigo-400 hover:bg-indigo-50"
          }`}
        >
          {pos}
        </button>
      ))}
    </div>
  );
}

function PositionBadges({ position }: { position: string }) {
  const positions = position.split(",").map((p) => p.trim()).filter(Boolean);
  return (
    <div className="flex flex-wrap gap-1">
      {positions.map((p) => (
        <span key={p} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">{p}</span>
      ))}
    </div>
  );
}

function escapeCsv(val: string): string {
  if (val.includes(",") || val.includes('"') || val.includes("\n")) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

function downloadVAInfo(vaList: VAProfile[]) {
  const headers = [
    "VA ID", "First Name", "Middle Name", "Last Name", "Suffix", "Date of Birth",
    "Phone", "Alt Phone", "Email", "Position", "Employment Status", "Date Hired", "Current Rate",
    "Contractor ID", "Street", "Subdivision", "Barangay", "City", "Province",
    "Postal Code", "Temporary Address", "Emergency Contact", "Emergency Phone",
    "Payout Mode", "PayPal Link", "EWallet Name", "EWallet Number",
    "Bank Name", "Bank Account Number", "Bank Account Name", "Weekly Report Link",
  ];
  const rows = vaList.map((va) => [
    va.id, va.firstName, va.middleName, va.lastName, va.suffix, va.dateOfBirth || "",
    va.phone, va.altPhone, va.email, va.position, va.employmentStatus || "", va.dateHired, va.currentRate,
    va.contractorId, va.permanentAddress.street, va.permanentAddress.subdivision,
    va.permanentAddress.barangay, va.permanentAddress.city, va.permanentAddress.province,
    va.permanentAddress.postalCode, va.temporaryAddress,
    va.emergencyContact, va.emergencyPhone,
    va.payoutMode || "", va.paypalLink || "", va.ewalletName || "", va.ewalletNumber || "",
    va.bankName || "", va.bankAccountNumber || "", va.bankAccountName || "",
    va.weeklyReportLink || "",
  ].map(escapeCsv).join(","));

  const csv = [headers.join(","), ...rows].join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `VA-Info-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function VAManagementPage() {
  const [vas, setVAs] = useState<VAProfile[]>([]);
  const [selectedVA, setSelectedVA] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [resetTarget, setResetTarget] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<string | null>(null);
  const [form, setForm] = useState({
    id: "", firstName: "", middleName: "", lastName: "", suffix: "",
    dateOfBirth: "", phone: "", altPhone: "", email: "", street: "", subdivision: "",
    barangay: "", city: "", province: "", postalCode: "",
    temporaryAddress: "", positions: ["Telemarketer"] as string[], employmentStatus: "Probationary Hire",
    dateHired: "", currentRate: "", emergencyContact: "", emergencyPhone: "",
    contractorId: "",
    payoutMode: "", paypalLink: "", ewalletName: "", ewalletNumber: "",
    bankName: "", bankAccountNumber: "", bankAccountName: "",
    weeklyReportLink: "",
  });
  const [editForm, setEditForm] = useState({
    firstName: "", middleName: "", lastName: "", suffix: "",
    dateOfBirth: "", phone: "", altPhone: "", email: "", street: "", subdivision: "",
    barangay: "", city: "", province: "", postalCode: "",
    temporaryAddress: "", positions: [] as string[], employmentStatus: "",
    dateHired: "", currentRate: "", emergencyContact: "", emergencyPhone: "",
    contractorId: "",
    payoutMode: "", paypalLink: "", ewalletName: "", ewalletNumber: "",
    bankName: "", bankAccountNumber: "", bankAccountName: "",
    weeklyReportLink: "",
  });

  const [counts, setCounts] = useState<Record<string, { adj: number; inv: number; req: number }>>({});
  const [columnVis, setColumnVis] = useState<Record<string, boolean>>(() => {
    const defaults: Record<string, boolean> = {};
    ALL_COLUMNS.forEach((c) => { defaults[c.key] = c.defaultVisible; });
    return defaults;
  });
  const [showColumnMenu, setShowColumnMenu] = useState(false);

  useEffect(() => {
    setColumnVis(loadColumnVisibility());
  }, []);

  function toggleColumn(key: string) {
    setColumnVis((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }

  const visibleColumns = ALL_COLUMNS.filter((c) => columnVis[c.key]);

  async function loadData() {
    const profiles = await actions.getProfiles();
    setVAs(profiles);
    const countMap: Record<string, { adj: number; inv: number; req: number }> = {};
    for (const va of profiles) {
      const [adj, inv, req] = await Promise.all([
        actions.getAdjustmentsFor(va.id),
        actions.getInvoicesFor(va.id),
        actions.getRequestsFor(va.id),
      ]);
      countMap[va.id] = { adj: adj.length, inv: inv.filter(i => i.invoiceNumber && i.amount).length, req: req.length };
    }
    setCounts(countMap);
  }

  useEffect(() => { (async () => { await loadData(); })(); }, []);

  const profile = selectedVA ? vas.find((v) => v.id === selectedVA) : null;

  function generateNextId() {
    const ids = vas.map((v) => parseInt(v.id));
    return String(Math.max(...ids, 500100) + 1);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const newVA: VAProfile = {
      id: form.id || generateNextId(),
      firstName: form.firstName, middleName: form.middleName,
      lastName: form.lastName, suffix: form.suffix,
      phone: form.phone, altPhone: form.altPhone || "N/A",
      email: form.email,
      dateOfBirth: form.dateOfBirth,
      permanentAddress: {
        street: form.street, subdivision: form.subdivision,
        barangay: form.barangay, city: form.city,
        province: form.province, postalCode: form.postalCode,
      },
      temporaryAddress: form.temporaryAddress || "Same as permanent address",
      position: form.positions.join(", "),
      employmentStatus: form.employmentStatus,
      dateHired: form.dateHired || new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
      currentRate: form.currentRate,
      emergencyContact: form.emergencyContact,
      emergencyPhone: form.emergencyPhone,
      password: "gyva2026",
      contractorId: form.contractorId,
      payoutMode: form.payoutMode,
      paypalLink: form.paypalLink,
      ewalletName: form.ewalletName,
      ewalletNumber: form.ewalletNumber,
      bankName: form.bankName,
      bankAccountNumber: form.bankAccountNumber,
      bankAccountName: form.bankAccountName,
      weeklyReportLink: form.weeklyReportLink,
    };
    await actions.addProfile(newVA);
    setShowCreate(false);
    setForm({
      id: "", firstName: "", middleName: "", lastName: "", suffix: "",
      dateOfBirth: "", phone: "", altPhone: "", email: "", street: "", subdivision: "",
      barangay: "", city: "", province: "", postalCode: "",
      temporaryAddress: "", positions: ["Telemarketer"], employmentStatus: "Probationary Hire",
      dateHired: "", currentRate: "", emergencyContact: "", emergencyPhone: "",
      contractorId: "",
      payoutMode: "", paypalLink: "", ewalletName: "", ewalletNumber: "",
      bankName: "", bankAccountNumber: "", bankAccountName: "",
      weeklyReportLink: "",
    });
    await loadData();
  }

  function openEdit(va: VAProfile) {
    const positions = va.position.split(",").map((p) => p.trim()).filter(Boolean);
    setEditForm({
      firstName: va.firstName, middleName: va.middleName,
      lastName: va.lastName, suffix: va.suffix,
      dateOfBirth: va.dateOfBirth || "",
      phone: va.phone, altPhone: va.altPhone, email: va.email,
      street: va.permanentAddress.street, subdivision: va.permanentAddress.subdivision,
      barangay: va.permanentAddress.barangay, city: va.permanentAddress.city,
      province: va.permanentAddress.province, postalCode: va.permanentAddress.postalCode,
      temporaryAddress: va.temporaryAddress,
      positions, employmentStatus: va.employmentStatus || "", dateHired: va.dateHired, currentRate: va.currentRate,
      emergencyContact: va.emergencyContact, emergencyPhone: va.emergencyPhone,
      contractorId: va.contractorId,
      payoutMode: va.payoutMode || "", paypalLink: va.paypalLink || "",
      ewalletName: va.ewalletName || "", ewalletNumber: va.ewalletNumber || "",
      bankName: va.bankName || "", bankAccountNumber: va.bankAccountNumber || "",
      bankAccountName: va.bankAccountName || "",
      weeklyReportLink: va.weeklyReportLink || "",
    });
    setEditTarget(va.id);
  }

  async function handleEditSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editTarget) return;
    await actions.updateProfile(editTarget, {
      firstName: editForm.firstName, middleName: editForm.middleName,
      lastName: editForm.lastName, suffix: editForm.suffix,
      dateOfBirth: editForm.dateOfBirth,
      phone: editForm.phone, altPhone: editForm.altPhone, email: editForm.email,
      permanentAddress: {
        street: editForm.street, subdivision: editForm.subdivision,
        barangay: editForm.barangay, city: editForm.city,
        province: editForm.province, postalCode: editForm.postalCode,
      },
      temporaryAddress: editForm.temporaryAddress,
      position: editForm.positions.join(", "),
      employmentStatus: editForm.employmentStatus,
      dateHired: editForm.dateHired, currentRate: editForm.currentRate,
      emergencyContact: editForm.emergencyContact, emergencyPhone: editForm.emergencyPhone,
      contractorId: editForm.contractorId,
      payoutMode: editForm.payoutMode, paypalLink: editForm.paypalLink,
      ewalletName: editForm.ewalletName, ewalletNumber: editForm.ewalletNumber,
      bankName: editForm.bankName, bankAccountNumber: editForm.bankAccountNumber,
      bankAccountName: editForm.bankAccountName,
      weeklyReportLink: editForm.weeklyReportLink,
    });
    setEditTarget(null);
    await loadData();
  }

  async function handleDelete(id: string) {
    await actions.deleteProfile(id);
    setDeleteTarget(null);
    await loadData();
  }

  async function handleResetPassword(id: string) {
    await actions.resetPassword(id);
    setResetTarget(null);
  }

  const inputClass = "w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">VA Management</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted">{vas.length} active VAs</span>
          <div className="relative">
            <button
              onClick={() => setShowColumnMenu((v) => !v)}
              className="border border-slate-300 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-slate-50 transition-colors"
            >
              <SlidersHorizontal size={16} /> Columns
            </button>
            {showColumnMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowColumnMenu(false)} />
                <div className="absolute right-0 top-full mt-2 w-56 bg-white border border-slate-200 rounded-xl shadow-lg z-50 py-2 max-h-80 overflow-y-auto">
                  <p className="px-4 py-1.5 text-xs font-semibold text-slate-500 uppercase">Toggle Columns</p>
                  {ALL_COLUMNS.map((col) => (
                    <button
                      key={col.key}
                      onClick={() => toggleColumn(col.key)}
                      className="w-full flex items-center gap-3 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      <div className={`w-4 h-4 rounded border flex items-center justify-center ${columnVis[col.key] ? "bg-indigo-600 border-indigo-600" : "border-slate-300"}`}>
                        {columnVis[col.key] && <Check size={12} className="text-white" />}
                      </div>
                      {col.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          <button
            onClick={() => downloadVAInfo(vas)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
          >
            <Download size={16} /> Download All ({vas.length})
          </button>
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
                {visibleColumns.map((col) => (
                  <th key={col.key} className="text-left px-6 py-3 font-semibold text-slate-600">{col.label}</th>
                ))}
                <th className="text-center px-6 py-3 font-semibold text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {vas.map((va) => (
                <tr key={va.id} className="border-b border-border hover:bg-slate-50/50 transition-colors">
                  {visibleColumns.map((col) => (
                    <td key={col.key} className="px-6 py-4">{col.render(va)}</td>
                  ))}
                  <td className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button onClick={() => setSelectedVA(va.id)} className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors">
                        <Eye size={14} /> View
                      </button>
                      <button onClick={() => openEdit(va)} className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-emerald-600 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors">
                        <Pencil size={14} /> Edit
                      </button>
                      <button onClick={() => setResetTarget(va.id)} className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-amber-600 bg-amber-50 rounded-lg hover:bg-amber-100 transition-colors">
                        <KeyRound size={14} /> Reset PW
                      </button>
                      <button onClick={() => setDeleteTarget(va.id)} className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors">
                        <Trash2 size={14} /> Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
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
                  <PositionBadges position={profile.position} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-start gap-2"><Mail size={16} className="text-slate-400 mt-0.5" /><div><p className="text-slate-500">Email</p><p className="font-medium text-slate-900">{profile.email}</p></div></div>
                <div className="flex items-start gap-2"><Phone size={16} className="text-slate-400 mt-0.5" /><div><p className="text-slate-500">Phone</p><p className="font-medium text-slate-900">{profile.phone}</p></div></div>
                <div className="flex items-start gap-2"><Briefcase size={16} className="text-slate-400 mt-0.5" /><div><p className="text-slate-500">Contractor ID</p><p className="font-medium text-slate-900">{profile.contractorId || "N/A"}</p></div></div>
                <div className="flex items-start gap-2"><Briefcase size={16} className="text-slate-400 mt-0.5" /><div><p className="text-slate-500">Date Hired</p><p className="font-medium text-slate-900">{profile.dateHired}</p></div></div>
                <div className="flex items-start gap-2"><Briefcase size={16} className="text-slate-400 mt-0.5" /><div><p className="text-slate-500">Current Rate</p><p className="font-medium text-slate-900">{profile.currentRate}</p></div></div>
              </div>
              <div className="flex items-start gap-2 text-sm pt-2 border-t border-slate-100">
                <MapPin size={16} className="text-slate-400 mt-0.5" />
                <div><p className="text-slate-500">Permanent Address</p><p className="font-medium text-slate-900">{profile.permanentAddress.street}, {profile.permanentAddress.subdivision}, {profile.permanentAddress.barangay}, {profile.permanentAddress.city}, {profile.permanentAddress.province} {profile.permanentAddress.postalCode}</p></div>
              </div>
              {profile.temporaryAddress && profile.temporaryAddress !== "Same as permanent address" && (
                <div className="flex items-start gap-2 text-sm">
                  <MapPin size={16} className="text-slate-400 mt-0.5" />
                  <div><p className="text-slate-500">Temporary Address</p><p className="font-medium text-slate-900">{profile.temporaryAddress}</p></div>
                </div>
              )}
              <div className="text-sm pt-2 border-t border-slate-100 space-y-3">
                <div className="flex items-start gap-2"><Wallet size={16} className="text-slate-400 mt-0.5" /><div><p className="text-slate-500">Payout Mode</p><p className="font-medium text-slate-900">{profile.payoutMode || "N/A"}</p></div></div>
                {profile.payoutMode === "Paypal" && (
                  <div className="flex items-start gap-2"><CreditCard size={16} className="text-slate-400 mt-0.5" /><div><p className="text-slate-500">PayPal Link</p><p className="font-medium text-slate-900">{profile.paypalLink || "N/A"}</p></div></div>
                )}
                {profile.payoutMode === "Ewallet" && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-start gap-2"><CreditCard size={16} className="text-slate-400 mt-0.5" /><div><p className="text-slate-500">EWallet Name</p><p className="font-medium text-slate-900">{profile.ewalletName || "N/A"}</p></div></div>
                    <div className="flex items-start gap-2"><CreditCard size={16} className="text-slate-400 mt-0.5" /><div><p className="text-slate-500">EWallet Number</p><p className="font-medium text-slate-900">{profile.ewalletNumber || "N/A"}</p></div></div>
                  </div>
                )}
                {profile.payoutMode === "Bank Transfer" && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-start gap-2"><CreditCard size={16} className="text-slate-400 mt-0.5" /><div><p className="text-slate-500">Bank</p><p className="font-medium text-slate-900">{profile.bankName || "N/A"}</p></div></div>
                    <div className="flex items-start gap-2"><CreditCard size={16} className="text-slate-400 mt-0.5" /><div><p className="text-slate-500">Account #</p><p className="font-medium text-slate-900">{profile.bankAccountNumber || "N/A"}</p></div></div>
                    <div className="flex items-start gap-2 col-span-2"><CreditCard size={16} className="text-slate-400 mt-0.5" /><div><p className="text-slate-500">Account Name</p><p className="font-medium text-slate-900">{profile.bankAccountName || "N/A"}</p></div></div>
                  </div>
                )}
                {(!profile.payoutMode || profile.payoutMode === "Wise") && profile.payoutMode !== "Paypal" && profile.payoutMode !== "Ewallet" && profile.payoutMode !== "Bank Transfer" && profile.bankName && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-start gap-2"><CreditCard size={16} className="text-slate-400 mt-0.5" /><div><p className="text-slate-500">Bank</p><p className="font-medium text-slate-900">{profile.bankName || "N/A"}</p></div></div>
                    <div className="flex items-start gap-2"><CreditCard size={16} className="text-slate-400 mt-0.5" /><div><p className="text-slate-500">Account #</p><p className="font-medium text-slate-900">{profile.bankAccountNumber || "N/A"}</p></div></div>
                    <div className="flex items-start gap-2 col-span-2"><CreditCard size={16} className="text-slate-400 mt-0.5" /><div><p className="text-slate-500">Account Name</p><p className="font-medium text-slate-900">{profile.bankAccountName || "N/A"}</p></div></div>
                  </div>
                )}
              </div>
              <div className="text-sm pt-2 border-t border-slate-100">
                <div className="flex items-start gap-2"><Heart size={16} className="text-slate-400 mt-0.5" /><div><p className="text-slate-500">Emergency Contact</p><p className="font-medium text-slate-900">{profile.emergencyContact} - {profile.emergencyPhone}</p></div></div>
              </div>
              <div className="text-sm pt-2 border-t border-slate-100">
                <div className="flex items-start gap-2"><ClipboardList size={16} className="text-slate-400 mt-0.5" /><div><p className="text-slate-500">Weekly Report Link</p>{profile.weeklyReportLink ? <a href={profile.weeklyReportLink} target="_blank" rel="noopener noreferrer" className="font-medium text-indigo-600 hover:underline break-all">{profile.weeklyReportLink}</a> : <p className="font-medium text-slate-900">N/A</p>}</div></div>
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

      {resetTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="p-6 text-center space-y-4">
              <div className="w-14 h-14 bg-amber-100 rounded-full flex items-center justify-center mx-auto"><KeyRound className="text-amber-600" size={28} /></div>
              <h3 className="text-lg font-bold text-slate-900">Reset Password</h3>
              <p className="text-sm text-slate-600">
                Reset the password for VA <strong>{resetTarget}</strong> ({vas.find((v) => v.id === resetTarget)?.firstName} {vas.find((v) => v.id === resetTarget)?.lastName}) to the default password <strong>gyva2026</strong>?
              </p>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setResetTarget(null)} className="flex-1 border border-slate-300 text-slate-700 font-medium py-2.5 rounded-lg hover:bg-slate-50 transition-colors text-sm">Cancel</button>
                <button onClick={() => handleResetPassword(resetTarget)} className="flex-1 bg-amber-600 hover:bg-amber-700 text-white font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm">
                  <KeyRound size={16} /> Reset
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
                  <div><label className="block text-xs font-medium text-slate-600 mb-1">Contractor ID</label><input type="text" value={form.contractorId} onChange={(e) => setForm((f) => ({ ...f, contractorId: e.target.value }))} className={inputClass} placeholder="e.g. CTR-2026-0001" /></div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-slate-600 mb-2">Position(s) *</label>
                    <PositionMultiSelect selected={form.positions} onChange={(v) => setForm((f) => ({ ...f, positions: v }))} />
                  </div>
                  <div><label className="block text-xs font-medium text-slate-600 mb-1">First Name *</label><input type="text" required value={form.firstName} onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))} className={inputClass} /></div>
                  <div><label className="block text-xs font-medium text-slate-600 mb-1">Middle Name</label><input type="text" value={form.middleName} onChange={(e) => setForm((f) => ({ ...f, middleName: e.target.value }))} className={inputClass} /></div>
                  <div><label className="block text-xs font-medium text-slate-600 mb-1">Last Name *</label><input type="text" required value={form.lastName} onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))} className={inputClass} /></div>
                  <div><label className="block text-xs font-medium text-slate-600 mb-1">Suffix</label><input type="text" value={form.suffix} onChange={(e) => setForm((f) => ({ ...f, suffix: e.target.value }))} className={inputClass} placeholder="Jr., Sr., III" /></div>
                  <div className="col-span-2"><label className="block text-xs font-medium text-slate-600 mb-1">Date of Birth</label><input type="text" value={form.dateOfBirth} onChange={(e) => setForm((f) => ({ ...f, dateOfBirth: e.target.value }))} className={inputClass} placeholder="e.g. January 15, 1995" /></div>
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
                  <div><label className="block text-xs font-medium text-slate-600 mb-1">Employment Status</label><select value={form.employmentStatus} onChange={(e) => setForm((f) => ({ ...f, employmentStatus: e.target.value }))} className={inputClass}>{EMPLOYMENT_STATUS_OPTIONS.map((s) => (<option key={s} value={s}>{s}</option>))}</select></div>
                  <div><label className="block text-xs font-medium text-slate-600 mb-1">Date Hired</label><input type="text" value={form.dateHired} onChange={(e) => setForm((f) => ({ ...f, dateHired: e.target.value }))} className={inputClass} placeholder="e.g. October 07, 2026" /></div>
                  <div><label className="block text-xs font-medium text-slate-600 mb-1">Hourly Rate *</label><input type="text" required value={form.currentRate} onChange={(e) => setForm((f) => ({ ...f, currentRate: e.target.value }))} className={inputClass} placeholder="$X.XX / Hour" /></div>
                  <div><label className="block text-xs font-medium text-slate-600 mb-1">Emergency Contact</label><input type="text" value={form.emergencyContact} onChange={(e) => setForm((f) => ({ ...f, emergencyContact: e.target.value }))} className={inputClass} /></div>
                  <div><label className="block text-xs font-medium text-slate-600 mb-1">Emergency Phone</label><input type="text" value={form.emergencyPhone} onChange={(e) => setForm((f) => ({ ...f, emergencyPhone: e.target.value }))} className={inputClass} /></div>
                </div>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-800 mb-3 pb-2 border-b border-slate-100">Payout Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2"><label className="block text-xs font-medium text-slate-600 mb-1">Mode of Payout</label><select value={form.payoutMode} onChange={(e) => setForm((f) => ({ ...f, payoutMode: e.target.value }))} className={inputClass}><option value="">Select payout mode</option>{PAYOUT_MODE_OPTIONS.map((m) => (<option key={m} value={m}>{m}</option>))}</select></div>
                  {form.payoutMode === "Paypal" && (
                    <div className="col-span-2"><label className="block text-xs font-medium text-slate-600 mb-1">PayPal Link</label><input type="text" value={form.paypalLink} onChange={(e) => setForm((f) => ({ ...f, paypalLink: e.target.value }))} className={inputClass} placeholder="e.g. paypal.me/username" /></div>
                  )}
                  {form.payoutMode === "Ewallet" && (
                    <>
                      <div><label className="block text-xs font-medium text-slate-600 mb-1">EWallet Name</label><select value={form.ewalletName} onChange={(e) => setForm((f) => ({ ...f, ewalletName: e.target.value }))} className={inputClass}><option value="">Select ewallet</option>{EWALLET_NAME_OPTIONS.map((n) => (<option key={n} value={n}>{n}</option>))}</select></div>
                      <div><label className="block text-xs font-medium text-slate-600 mb-1">EWallet Number</label><input type="text" value={form.ewalletNumber} onChange={(e) => setForm((f) => ({ ...f, ewalletNumber: e.target.value }))} className={inputClass} placeholder="e.g. 09XX XXX XXXX" /></div>
                    </>
                  )}
                  {form.payoutMode === "Bank Transfer" && (
                    <>
                      <div className="col-span-2"><label className="block text-xs font-medium text-slate-600 mb-1">Bank Name</label><input type="text" value={form.bankName} onChange={(e) => setForm((f) => ({ ...f, bankName: e.target.value }))} className={inputClass} placeholder="e.g. BDO, BPI" /></div>
                      <div><label className="block text-xs font-medium text-slate-600 mb-1">Account Number</label><input type="text" value={form.bankAccountNumber} onChange={(e) => setForm((f) => ({ ...f, bankAccountNumber: e.target.value }))} className={inputClass} /></div>
                      <div><label className="block text-xs font-medium text-slate-600 mb-1">Account Name</label><input type="text" value={form.bankAccountName} onChange={(e) => setForm((f) => ({ ...f, bankAccountName: e.target.value }))} className={inputClass} /></div>
                    </>
                  )}
                </div>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-800 mb-3 pb-2 border-b border-slate-100">Weekly Report</h3>
                <div><label className="block text-xs font-medium text-slate-600 mb-1">Google Sheet Link</label><input type="text" value={form.weeklyReportLink} onChange={(e) => setForm((f) => ({ ...f, weeklyReportLink: e.target.value }))} className={inputClass} placeholder="https://docs.google.com/spreadsheets/d/..." /></div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowCreate(false)} className="flex-1 border border-slate-300 text-slate-700 font-medium py-2.5 rounded-lg hover:bg-slate-50 transition-colors">Cancel</button>
                <button type="submit" className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2"><Plus size={16} /> Create VA Account</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 sticky top-0 bg-white rounded-t-2xl z-10">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2"><Pencil size={20} className="text-emerald-600" /> Edit VA - {editTarget}</h2>
              <button onClick={() => setEditTarget(null)} className="p-1 hover:bg-slate-100 rounded-lg"><X size={20} className="text-slate-500" /></button>
            </div>
            <form onSubmit={handleEditSave} className="p-6 space-y-5">
              <div>
                <h3 className="text-sm font-semibold text-slate-800 mb-3 pb-2 border-b border-slate-100">Personal Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-xs font-medium text-slate-600 mb-1">Contractor ID</label><input type="text" value={editForm.contractorId} onChange={(e) => setEditForm((f) => ({ ...f, contractorId: e.target.value }))} className={inputClass} /></div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-slate-600 mb-2">Position(s) *</label>
                    <PositionMultiSelect selected={editForm.positions} onChange={(v) => setEditForm((f) => ({ ...f, positions: v }))} />
                  </div>
                  <div><label className="block text-xs font-medium text-slate-600 mb-1">First Name *</label><input type="text" required value={editForm.firstName} onChange={(e) => setEditForm((f) => ({ ...f, firstName: e.target.value }))} className={inputClass} /></div>
                  <div><label className="block text-xs font-medium text-slate-600 mb-1">Middle Name</label><input type="text" value={editForm.middleName} onChange={(e) => setEditForm((f) => ({ ...f, middleName: e.target.value }))} className={inputClass} /></div>
                  <div><label className="block text-xs font-medium text-slate-600 mb-1">Last Name *</label><input type="text" required value={editForm.lastName} onChange={(e) => setEditForm((f) => ({ ...f, lastName: e.target.value }))} className={inputClass} /></div>
                  <div><label className="block text-xs font-medium text-slate-600 mb-1">Suffix</label><input type="text" value={editForm.suffix} onChange={(e) => setEditForm((f) => ({ ...f, suffix: e.target.value }))} className={inputClass} placeholder="Jr., Sr., III" /></div>
                  <div className="col-span-2"><label className="block text-xs font-medium text-slate-600 mb-1">Date of Birth</label><input type="text" value={editForm.dateOfBirth} onChange={(e) => setEditForm((f) => ({ ...f, dateOfBirth: e.target.value }))} className={inputClass} placeholder="e.g. January 15, 1995" /></div>
                </div>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-800 mb-3 pb-2 border-b border-slate-100">Contact Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-xs font-medium text-slate-600 mb-1">Email *</label><input type="email" required value={editForm.email} onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))} className={inputClass} /></div>
                  <div><label className="block text-xs font-medium text-slate-600 mb-1">Phone *</label><input type="text" required value={editForm.phone} onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))} className={inputClass} /></div>
                  <div className="col-span-2"><label className="block text-xs font-medium text-slate-600 mb-1">Alt Phone</label><input type="text" value={editForm.altPhone} onChange={(e) => setEditForm((f) => ({ ...f, altPhone: e.target.value }))} className={inputClass} /></div>
                </div>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-800 mb-3 pb-2 border-b border-slate-100">Permanent Address</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-xs font-medium text-slate-600 mb-1">Street</label><input type="text" value={editForm.street} onChange={(e) => setEditForm((f) => ({ ...f, street: e.target.value }))} className={inputClass} /></div>
                  <div><label className="block text-xs font-medium text-slate-600 mb-1">Subdivision</label><input type="text" value={editForm.subdivision} onChange={(e) => setEditForm((f) => ({ ...f, subdivision: e.target.value }))} className={inputClass} /></div>
                  <div><label className="block text-xs font-medium text-slate-600 mb-1">Barangay</label><input type="text" value={editForm.barangay} onChange={(e) => setEditForm((f) => ({ ...f, barangay: e.target.value }))} className={inputClass} /></div>
                  <div><label className="block text-xs font-medium text-slate-600 mb-1">City</label><input type="text" value={editForm.city} onChange={(e) => setEditForm((f) => ({ ...f, city: e.target.value }))} className={inputClass} /></div>
                  <div><label className="block text-xs font-medium text-slate-600 mb-1">Province</label><input type="text" value={editForm.province} onChange={(e) => setEditForm((f) => ({ ...f, province: e.target.value }))} className={inputClass} /></div>
                  <div><label className="block text-xs font-medium text-slate-600 mb-1">Postal Code</label><input type="text" value={editForm.postalCode} onChange={(e) => setEditForm((f) => ({ ...f, postalCode: e.target.value }))} className={inputClass} /></div>
                  <div className="col-span-2"><label className="block text-xs font-medium text-slate-600 mb-1">Temporary Address</label><input type="text" value={editForm.temporaryAddress} onChange={(e) => setEditForm((f) => ({ ...f, temporaryAddress: e.target.value }))} className={inputClass} /></div>
                </div>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-800 mb-3 pb-2 border-b border-slate-100">Employment & Emergency</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-xs font-medium text-slate-600 mb-1">Employment Status</label><select value={editForm.employmentStatus} onChange={(e) => setEditForm((f) => ({ ...f, employmentStatus: e.target.value }))} className={inputClass}><option value="">Select status</option>{EMPLOYMENT_STATUS_OPTIONS.map((s) => (<option key={s} value={s}>{s}</option>))}</select></div>
                  <div><label className="block text-xs font-medium text-slate-600 mb-1">Date Hired</label><input type="text" value={editForm.dateHired} onChange={(e) => setEditForm((f) => ({ ...f, dateHired: e.target.value }))} className={inputClass} /></div>
                  <div><label className="block text-xs font-medium text-slate-600 mb-1">Hourly Rate</label><input type="text" value={editForm.currentRate} onChange={(e) => setEditForm((f) => ({ ...f, currentRate: e.target.value }))} className={inputClass} /></div>
                  <div><label className="block text-xs font-medium text-slate-600 mb-1">Emergency Contact</label><input type="text" value={editForm.emergencyContact} onChange={(e) => setEditForm((f) => ({ ...f, emergencyContact: e.target.value }))} className={inputClass} /></div>
                  <div><label className="block text-xs font-medium text-slate-600 mb-1">Emergency Phone</label><input type="text" value={editForm.emergencyPhone} onChange={(e) => setEditForm((f) => ({ ...f, emergencyPhone: e.target.value }))} className={inputClass} /></div>
                </div>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-800 mb-3 pb-2 border-b border-slate-100">Payout Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2"><label className="block text-xs font-medium text-slate-600 mb-1">Mode of Payout</label><select value={editForm.payoutMode} onChange={(e) => setEditForm((f) => ({ ...f, payoutMode: e.target.value }))} className={inputClass}><option value="">Select payout mode</option>{PAYOUT_MODE_OPTIONS.map((m) => (<option key={m} value={m}>{m}</option>))}</select></div>
                  {editForm.payoutMode === "Paypal" && (
                    <div className="col-span-2"><label className="block text-xs font-medium text-slate-600 mb-1">PayPal Link</label><input type="text" value={editForm.paypalLink} onChange={(e) => setEditForm((f) => ({ ...f, paypalLink: e.target.value }))} className={inputClass} placeholder="e.g. paypal.me/username" /></div>
                  )}
                  {editForm.payoutMode === "Ewallet" && (
                    <>
                      <div><label className="block text-xs font-medium text-slate-600 mb-1">EWallet Name</label><select value={editForm.ewalletName} onChange={(e) => setEditForm((f) => ({ ...f, ewalletName: e.target.value }))} className={inputClass}><option value="">Select ewallet</option>{EWALLET_NAME_OPTIONS.map((n) => (<option key={n} value={n}>{n}</option>))}</select></div>
                      <div><label className="block text-xs font-medium text-slate-600 mb-1">EWallet Number</label><input type="text" value={editForm.ewalletNumber} onChange={(e) => setEditForm((f) => ({ ...f, ewalletNumber: e.target.value }))} className={inputClass} placeholder="e.g. 09XX XXX XXXX" /></div>
                    </>
                  )}
                  {editForm.payoutMode === "Bank Transfer" && (
                    <>
                      <div className="col-span-2"><label className="block text-xs font-medium text-slate-600 mb-1">Bank Name</label><input type="text" value={editForm.bankName} onChange={(e) => setEditForm((f) => ({ ...f, bankName: e.target.value }))} className={inputClass} placeholder="e.g. BDO, BPI" /></div>
                      <div><label className="block text-xs font-medium text-slate-600 mb-1">Account Number</label><input type="text" value={editForm.bankAccountNumber} onChange={(e) => setEditForm((f) => ({ ...f, bankAccountNumber: e.target.value }))} className={inputClass} /></div>
                      <div><label className="block text-xs font-medium text-slate-600 mb-1">Account Name</label><input type="text" value={editForm.bankAccountName} onChange={(e) => setEditForm((f) => ({ ...f, bankAccountName: e.target.value }))} className={inputClass} /></div>
                    </>
                  )}
                </div>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-800 mb-3 pb-2 border-b border-slate-100">Weekly Report</h3>
                <div><label className="block text-xs font-medium text-slate-600 mb-1">Google Sheet Link</label><input type="text" value={editForm.weeklyReportLink} onChange={(e) => setEditForm((f) => ({ ...f, weeklyReportLink: e.target.value }))} className={inputClass} placeholder="https://docs.google.com/spreadsheets/d/..." /></div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setEditTarget(null)} className="flex-1 border border-slate-300 text-slate-700 font-medium py-2.5 rounded-lg hover:bg-slate-50 transition-colors">Cancel</button>
                <button type="submit" className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2"><Save size={16} /> Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
