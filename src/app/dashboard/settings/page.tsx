"use client";

import { useEffect, useState } from "react";
import * as actions from "@/lib/actions";
import type { VAProfile } from "@/lib/data";
import { Settings, KeyRound, X } from "lucide-react";

export default function VASettingsPage() {
  const [profile, setProfile] = useState<VAProfile | null>(null);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [pwForm, setPwForm] = useState({ current: "", newPw: "", confirm: "" });
  const [pwMsg, setPwMsg] = useState({ text: "", ok: false });

  useEffect(() => {
    (async () => {
      const id = localStorage.getItem("vaId") || "";
      const p = (await actions.getProfile(id)) || null;
      setProfile(p);
    })();
  }, []);

  async function handleChangePassword(e: React.FormEvent) {
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
    await actions.updateProfile(profile.id, { password: pwForm.newPw });
    const updated = await actions.getProfile(profile.id);
    setProfile(updated || null);
    setPwMsg({ text: "Password changed successfully!", ok: true });
    setPwForm({ current: "", newPw: "", confirm: "" });
    setTimeout(() => { setShowPasswordForm(false); setPwMsg({ text: "", ok: false }); }, 2000);
  }

  if (!profile) return null;

  const inputClass = "w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm";

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
        <Settings size={24} /> Settings
      </h1>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-foreground">Change Password</h3>
              <p className="text-sm text-muted mt-1">Update your account password for security.</p>
            </div>
            <button
              onClick={() => setShowPasswordForm(true)}
              className="bg-amber-50 hover:bg-amber-100 text-amber-700 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors border border-amber-200"
            >
              <KeyRound size={16} /> Change Password
            </button>
          </div>
        </div>
      </div>

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
