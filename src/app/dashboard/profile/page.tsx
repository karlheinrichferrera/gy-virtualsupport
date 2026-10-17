"use client";

import { useEffect, useState } from "react";
import * as actions from "@/lib/actions";
import type { VAProfile } from "@/lib/data";
import { User, Phone, MapPin, Briefcase, Heart, CreditCard, Pencil, Save, X, Wallet, Camera, Clock } from "lucide-react";

const PAYOUT_MODE_OPTIONS = ["Paypal", "Wise", "Bank Transfer", "Ewallet"];
const EWALLET_NAME_OPTIONS = ["Gcash", "Maya", "Maribank", "GoTyme"];

export default function ProfilePage() {
  const [profile, setProfile] = useState<VAProfile | null>(null);
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
    (async () => {
      const id = localStorage.getItem("vaId") || "";
      const p = (await actions.getProfile(id)) || null;
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
    })();
  }, []);

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    await actions.updateProfile(profile.id, {
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
    const updated = await actions.getProfile(profile.id);
    setProfile(updated || null);
    setEditing(false);
  }

  if (!profile) return null;

  const addr = profile.permanentAddress;
  const inputClass = "w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm";

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-foreground">My Information</h1>
        <div className="flex gap-2">
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
              <div className="relative group">
                {profile.profilePicture ? (
                  <img src={profile.profilePicture} alt="Profile" className="w-16 h-16 rounded-full object-cover border-2 border-white/30" />
                ) : (
                  <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center text-white text-2xl font-bold">
                    {profile.firstName.charAt(0)}{profile.lastName.charAt(0)}
                  </div>
                )}
                <label className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
                  <Camera size={20} className="text-white" />
                  <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const canvas = document.createElement("canvas");
                    const img = document.createElement("img");
                    img.src = URL.createObjectURL(file);
                    await new Promise((r) => { img.onload = r; });
                    const size = 256;
                    canvas.width = size;
                    canvas.height = size;
                    const ctx = canvas.getContext("2d")!;
                    const min = Math.min(img.width, img.height);
                    ctx.drawImage(img, (img.width - min) / 2, (img.height - min) / 2, min, min, 0, 0, size, size);
                    const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
                    URL.revokeObjectURL(img.src);
                    await actions.updateProfile(profile.id, { profilePicture: dataUrl });
                    const updated = await actions.getProfile(profile.id);
                    setProfile(updated || null);
                  }} />
                </label>
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

            <Section icon={Clock} title="Work Schedule">
              <WorkScheduleView schedule={profile.workSchedule} />
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

    </div>
  );
}

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;
const DAY_LABELS: Record<string, string> = { monday: "Mon", tuesday: "Tue", wednesday: "Wed", thursday: "Thu", friday: "Fri", saturday: "Sat", sunday: "Sun" };

function fmt24to12(t: string): string {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hr = h % 12 || 12;
  return `${hr}:${String(m).padStart(2, "0")} ${ampm}`;
}

function WorkScheduleView({ schedule }: { schedule: VAProfile["workSchedule"] }) {
  const hasSchedule = DAYS.some((d) => schedule?.[d]?.enabled);
  if (!hasSchedule) return <span className="text-slate-400 text-sm italic">No schedule set</span>;
  return (
    <div className="space-y-1 col-span-full">
      {DAYS.map((day) => {
        const d = schedule[day];
        return (
          <div key={day} className="flex items-center gap-2 text-sm">
            <span className={`w-10 font-medium ${d.enabled ? "text-foreground" : "text-slate-300"}`}>{DAY_LABELS[day]}</span>
            {d.enabled ? (
              <span className="text-foreground">{fmt24to12(d.start)} - {fmt24to12(d.end)}</span>
            ) : (
              <span className="text-slate-300 italic">Off</span>
            )}
          </div>
        );
      })}
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
