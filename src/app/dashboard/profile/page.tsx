"use client";

import { useEffect, useState } from "react";
import * as store from "@/lib/store";
import type { VAProfile } from "@/lib/data";
import { User, Phone, MapPin, Briefcase, Heart, KeyRound, CreditCard, Pencil, Save, X, Wallet } from "lucide-react";

const PAYOUT_MODE_OPTIONS = ["Paypal", "Wise", "Bank Transfer", "Ewallet"];
const EWALLET_NAME_OPTIONS = ["Gcash", "Maya", "Maribank", "GoTyme"];

export default function ProfilePage() {
  const [profile, setProfile] = useState<VAProfile | null>(null);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [pwForm, setPwForm] = useState({ current: "", newPw: "", confirm: "" });
  const [pwMsg, setPwMsg] = useState({ text: "", ok: false });
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    phone: "", altPhone: "", email: "",
    street: "", subdivision: "", barangay: "", city: "", province: "", postalCode: "",
    temporaryAddress: "",
    emergencyContact: "", emergencyPhone: "",
    payoutMode: "", paypalLink: "", ewalletName: "", ewalletNumber: "",
    bankName: "", bankAccountNumber: "", bankAccountName: "",
  });

  useEffect(() => {
    const id = localStorage.getItem("vaId") || "";
    const p = store.getProfile(id) || null;
    setProfile(p);
    if (p) {
      setEditForm({
        phone: p.phone, altPhone: p.altPhone, email: p.email,
        street: p.permanentAddress.street, subdivision: p.permanentAddress.subdivision,
        barangay: p.permanentAddress.barangay, city: p.permanentAddress.city,
        province: p.permanentAddress.province, postalCode: p.permanentAddress.postalCode,
        temporaryAddress: p.temporaryAddress,
        emergencyContact: p.emergencyContact, emergencyPhone: p.emergencyPhone,
        payoutMode: p.payoutMode || "", paypalLink: p.paypalLink || "",
        ewalletName: p.ewalletName || "", ewalletNumber: p.ewalletNumber || "",
        bankName: p.bankName || "", bankAccountNumber: p.bankAccountNumber || "",
        bankAccountName: p.bankAccountName || "",
      });
    }
  }, []);

  function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    const stored = profile.password || "gyva2026";
    if (pwForm.current !== stored) {
      setPwMsg({ text: "Current password is incorrect.", ok: false });
      return;
    }
    if (pwForm.newPw.length < 6) {
      setPwMsg({ text: "New password must be at least 6 characters.", ok: false });
      return;
    }
    if (pwForm.newPw !== pwForm.confirm) {
      setPwMsg({ text: "New passwords do not match.", ok: false });
      return;
    }
    store.updateProfile(profile.id, { password: pwForm.newPw });
    setProfile(store.getProfile(profile.id) || null);
    setPwMsg({ text: "Password changed successfully!", ok: true });
    setPwForm({ current: "", newPw: "", confirm: "" });
    setTimeout(() => { setShowPasswordForm(false); setPwMsg({ text: "", ok: false }); }, 2000);
  }

  function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    store.updateProfile(profile.id, {
      phone: editForm.phone, altPhone: editForm.altPhone, email: editForm.email,
      permanentAddress: {
        street: editForm.street, subdivision: editForm.subdivision,
        barangay: editForm.barangay, city: editForm.city,
        province: editForm.province, postalCode: editForm.postalCode,
      },
      temporaryAddress: editForm.temporaryAddress,
      emergencyContact: editForm.emergencyContact, emergencyPhone: editForm.emergencyPhone,
      payoutMode: editForm.payoutMode, paypalLink: editForm.paypalLink,
      ewalletName: editForm.ewalletName, ewalletNumber: editForm.ewalletNumber,
      bankName: editForm.bankName, bankAccountNumber: editForm.bankAccountNumber,
      bankAccountName: editForm.bankAccountName,
    });
    setProfile(store.getProfile(profile.id) || null);
    setEditing(false);
  }

  if (!profile) return null;

  const addr = profile.permanentAddress;
  const inputClass = "w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm";

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">My Information</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setShowPasswordForm(true)}
            className="bg-amber-50 hover:bg-amber-100 text-amber-700 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors border border-amber-200"
          >
            <KeyRound size={16} /> Change Password
          </button>
          {!editing ? (
            <button
              onClick={() => setEditing(true)}
              className="bg-blue-50 hover:bg-blue-100 text-blue-700 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors border border-blue-200"
            >
              <Pencil size={16} /> Edit Info
            </button>
          ) : (
            <button
              onClick={() => setEditing(false)}
              className="bg-slate-50 hover:bg-slate-100 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors border border-slate-200"
            >
              <X size={16} /> Cancel
            </button>
          )}
        </div>
      </div>

      {editing ? (
        <form onSubmit={handleSaveProfile} className="bg-card rounded-xl border border-border p-6 space-y-6">
          <Section icon={Phone} title="Contact Information">
            <div><span className="text-xs text-muted uppercase tracking-wide">Email</span><input type="email" value={editForm.email} onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))} className={inputClass} /></div>
            <div><span className="text-xs text-muted uppercase tracking-wide">Primary Phone</span><input type="text" value={editForm.phone} onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))} className={inputClass} /></div>
            <div><span className="text-xs text-muted uppercase tracking-wide">Alternate Phone</span><input type="text" value={editForm.altPhone} onChange={(e) => setEditForm((f) => ({ ...f, altPhone: e.target.value }))} className={inputClass} /></div>
          </Section>

          <Section icon={MapPin} title="Permanent Address">
            <div><span className="text-xs text-muted uppercase tracking-wide">Street</span><input type="text" value={editForm.street} onChange={(e) => setEditForm((f) => ({ ...f, street: e.target.value }))} className={inputClass} /></div>
            <div><span className="text-xs text-muted uppercase tracking-wide">Subdivision</span><input type="text" value={editForm.subdivision} onChange={(e) => setEditForm((f) => ({ ...f, subdivision: e.target.value }))} className={inputClass} /></div>
            <div><span className="text-xs text-muted uppercase tracking-wide">Barangay</span><input type="text" value={editForm.barangay} onChange={(e) => setEditForm((f) => ({ ...f, barangay: e.target.value }))} className={inputClass} /></div>
            <div><span className="text-xs text-muted uppercase tracking-wide">City / Municipality</span><input type="text" value={editForm.city} onChange={(e) => setEditForm((f) => ({ ...f, city: e.target.value }))} className={inputClass} /></div>
            <div><span className="text-xs text-muted uppercase tracking-wide">Province</span><input type="text" value={editForm.province} onChange={(e) => setEditForm((f) => ({ ...f, province: e.target.value }))} className={inputClass} /></div>
            <div><span className="text-xs text-muted uppercase tracking-wide">Postal Code</span><input type="text" value={editForm.postalCode} onChange={(e) => setEditForm((f) => ({ ...f, postalCode: e.target.value }))} className={inputClass} /></div>
          </Section>

          <Section icon={MapPin} title="Temporary Address">
            <div className="col-span-full"><input type="text" value={editForm.temporaryAddress} onChange={(e) => setEditForm((f) => ({ ...f, temporaryAddress: e.target.value }))} className={inputClass} /></div>
          </Section>

          <Section icon={Heart} title="Emergency Contact">
            <div><span className="text-xs text-muted uppercase tracking-wide">Contact Person</span><input type="text" value={editForm.emergencyContact} onChange={(e) => setEditForm((f) => ({ ...f, emergencyContact: e.target.value }))} className={inputClass} /></div>
            <div><span className="text-xs text-muted uppercase tracking-wide">Contact Number</span><input type="text" value={editForm.emergencyPhone} onChange={(e) => setEditForm((f) => ({ ...f, emergencyPhone: e.target.value }))} className={inputClass} /></div>
          </Section>

          <Section icon={Wallet} title="Payout Information">
            <div><span className="text-xs text-muted uppercase tracking-wide">Mode of Payout</span><select value={editForm.payoutMode} onChange={(e) => setEditForm((f) => ({ ...f, payoutMode: e.target.value }))} className={inputClass}><option value="">Select payout mode</option>{PAYOUT_MODE_OPTIONS.map((m) => (<option key={m} value={m}>{m}</option>))}</select></div>
            {editForm.payoutMode === "Paypal" && (
              <div><span className="text-xs text-muted uppercase tracking-wide">PayPal Link</span><input type="text" value={editForm.paypalLink} onChange={(e) => setEditForm((f) => ({ ...f, paypalLink: e.target.value }))} className={inputClass} placeholder="e.g. paypal.me/username" /></div>
            )}
            {editForm.payoutMode === "Ewallet" && (
              <>
                <div><span className="text-xs text-muted uppercase tracking-wide">EWallet Name</span><select value={editForm.ewalletName} onChange={(e) => setEditForm((f) => ({ ...f, ewalletName: e.target.value }))} className={inputClass}><option value="">Select ewallet</option>{EWALLET_NAME_OPTIONS.map((n) => (<option key={n} value={n}>{n}</option>))}</select></div>
                <div><span className="text-xs text-muted uppercase tracking-wide">EWallet Number</span><input type="text" value={editForm.ewalletNumber} onChange={(e) => setEditForm((f) => ({ ...f, ewalletNumber: e.target.value }))} className={inputClass} placeholder="e.g. 09XX XXX XXXX" /></div>
              </>
            )}
            {editForm.payoutMode === "Bank Transfer" && (
              <>
                <div><span className="text-xs text-muted uppercase tracking-wide">Bank Name</span><input type="text" value={editForm.bankName} onChange={(e) => setEditForm((f) => ({ ...f, bankName: e.target.value }))} className={inputClass} placeholder="e.g. BDO, BPI" /></div>
                <div><span className="text-xs text-muted uppercase tracking-wide">Account Number</span><input type="text" value={editForm.bankAccountNumber} onChange={(e) => setEditForm((f) => ({ ...f, bankAccountNumber: e.target.value }))} className={inputClass} /></div>
                <div><span className="text-xs text-muted uppercase tracking-wide">Account Name</span><input type="text" value={editForm.bankAccountName} onChange={(e) => setEditForm((f) => ({ ...f, bankAccountName: e.target.value }))} className={inputClass} /></div>
              </>
            )}
          </Section>

          <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2">
            <Save size={16} /> Save Changes
          </button>
        </form>
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-blue-800 px-6 py-8">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center text-white text-2xl font-bold">
                {profile.firstName.charAt(0)}
                {profile.lastName.charAt(0)}
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">
                  {profile.firstName} {profile.middleName} {profile.lastName}{" "}
                  {profile.suffix}
                </h2>
                <p className="text-blue-200">VA ID: {profile.id}</p>
                {profile.contractorId && (
                  <p className="text-blue-200">Contractor ID: {profile.contractorId}</p>
                )}
              </div>
            </div>
          </div>

          <div className="p-6 space-y-6">
            <Section icon={User} title="Personal Information">
              <Field label="First Name" value={profile.firstName} />
              <Field label="Middle Name" value={profile.middleName} />
              <Field label="Last Name" value={profile.lastName} />
              <Field label="Suffix" value={profile.suffix || "N/A"} />
              <Field label="Email" value={profile.email} />
              <Field label="Date of Birth" value={profile.dateOfBirth || "N/A"} />
              <Field label="Contractor ID" value={profile.contractorId || "N/A"} />
            </Section>

            <Section icon={Phone} title="Contact Information">
              <Field label="Primary Phone" value={profile.phone} />
              <Field label="Alternate Phone" value={profile.altPhone} />
            </Section>

            <Section icon={MapPin} title="Permanent Address">
              <Field label="Street" value={addr.street} />
              <Field label="Subdivision" value={addr.subdivision} />
              <Field label="Barangay" value={addr.barangay} />
              <Field label="City / Municipality" value={addr.city} />
              <Field label="Province" value={addr.province} />
              <Field label="Postal Code" value={addr.postalCode} />
            </Section>

            <Section icon={MapPin} title="Temporary Address">
              <div className="col-span-full text-sm text-muted italic">
                {profile.temporaryAddress}
              </div>
            </Section>

            <Section icon={Briefcase} title="Employment Details">
              <div>
                <span className="text-xs text-muted uppercase tracking-wide">Position</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {profile.position.split(",").map((p) => p.trim()).filter(Boolean).map((p) => (
                    <span key={p} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">{p}</span>
                  ))}
                </div>
              </div>
              <div>
                <span className="text-xs text-muted uppercase tracking-wide">Employment Status</span>
                <div className="mt-1">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                    profile.employmentStatus === "Regular Hire" ? "bg-emerald-100 text-emerald-700" :
                    profile.employmentStatus === "Probationary Hire" ? "bg-amber-100 text-amber-700" :
                    profile.employmentStatus === "Seasonal / Contractual Hire" ? "bg-blue-100 text-blue-700" :
                    profile.employmentStatus === "Terminated" ? "bg-red-100 text-red-700" :
                    profile.employmentStatus === "Resigned" ? "bg-slate-100 text-slate-600" :
                    "bg-slate-100 text-slate-600"
                  }`}>
                    {profile.employmentStatus || "N/A"}
                  </span>
                </div>
              </div>
              <Field label="Date Hired" value={profile.dateHired} />
              <Field label="Current Rate" value={profile.currentRate} />
            </Section>

            <Section icon={Wallet} title="Payout Information">
              <Field label="Mode of Payout" value={profile.payoutMode || "N/A"} />
              {profile.payoutMode === "Paypal" && (
                <Field label="PayPal Link" value={profile.paypalLink || "N/A"} />
              )}
              {profile.payoutMode === "Ewallet" && (
                <>
                  <Field label="EWallet Name" value={profile.ewalletName || "N/A"} />
                  <Field label="EWallet Number" value={profile.ewalletNumber || "N/A"} />
                </>
              )}
              {profile.payoutMode === "Bank Transfer" && (
                <>
                  <Field label="Bank Name" value={profile.bankName || "N/A"} />
                  <Field label="Account Number" value={profile.bankAccountNumber || "N/A"} />
                  <Field label="Account Name" value={profile.bankAccountName || "N/A"} />
                </>
              )}
            </Section>

            <Section icon={Heart} title="Emergency Contact">
              <Field label="Contact Person" value={profile.emergencyContact} />
              <Field label="Contact Number" value={profile.emergencyPhone} />
            </Section>
          </div>
        </div>
      )}

      {showPasswordForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <KeyRound size={20} className="text-amber-600" /> Change Password
              </h2>
              <button onClick={() => { setShowPasswordForm(false); setPwMsg({ text: "", ok: false }); }} className="p-1 hover:bg-slate-100 rounded-lg">
                <X size={20} className="text-slate-500" />
              </button>
            </div>
            <form onSubmit={handleChangePassword} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Current Password</label>
                <input type="password" value={pwForm.current} onChange={(e) => setPwForm((f) => ({ ...f, current: e.target.value }))} required className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">New Password</label>
                <input type="password" value={pwForm.newPw} onChange={(e) => setPwForm((f) => ({ ...f, newPw: e.target.value }))} required className={inputClass} placeholder="Min 6 characters" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Confirm New Password</label>
                <input type="password" value={pwForm.confirm} onChange={(e) => setPwForm((f) => ({ ...f, confirm: e.target.value }))} required className={inputClass} />
              </div>
              {pwMsg.text && (
                <p className={`text-sm px-3 py-2 rounded-lg ${pwMsg.ok ? "text-emerald-700 bg-emerald-50" : "text-red-600 bg-red-50"}`}>{pwMsg.text}</p>
              )}
              <button type="submit" className="w-full bg-amber-600 hover:bg-amber-700 text-white font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2">
                <KeyRound size={16} /> Update Password
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border">
        <Icon size={18} className="text-primary" />
        <h3 className="font-semibold text-foreground">{title}</h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {children}
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-xs text-muted uppercase tracking-wide">
        {label}
      </span>
      <p className="text-sm font-medium text-foreground mt-0.5">{value}</p>
    </div>
  );
}
