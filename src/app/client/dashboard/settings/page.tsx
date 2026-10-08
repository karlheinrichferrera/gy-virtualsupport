"use client";

import { useState, useEffect } from "react";
import * as actions from "@/lib/actions";
import type { ClientAccount } from "@/lib/actions";
import { Settings, Save, KeyRound, Building2 } from "lucide-react";

const inputClass =
  "w-full px-4 py-2.5 rounded-lg border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm";

export default function ClientSettingsPage() {
  const [account, setAccount] = useState<ClientAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");

  // Company info form
  const [displayName, setDisplayName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [savingInfo, setSavingInfo] = useState(false);
  const [infoMessage, setInfoMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Password form
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    (async () => {
      const storedEmail = localStorage.getItem("clientEmail");
      if (!storedEmail) return;
      setEmail(storedEmail);
      try {
        const data = await actions.getClientAccountByEmail(storedEmail);
        if (data) {
          setAccount(data);
          setDisplayName(data.displayName || "");
          setCompanyName(data.companyName || "");
          setAddress(data.address || "");
          setPhone(data.phone || "");
        }
      } catch {
        // ignore
      }
      setLoading(false);
    })();
  }, []);

  const handleSaveInfo = async () => {
    setSavingInfo(true);
    setInfoMessage(null);
    try {
      await actions.updateClientAccountByEmail(email, {
        displayName,
        companyName,
        address,
        phone,
      });
      setInfoMessage({ type: "success", text: "Company information updated successfully." });
    } catch {
      setInfoMessage({ type: "error", text: "Failed to update company information. Please try again." });
    }
    setSavingInfo(false);
  };

  const handleChangePassword = async () => {
    setPasswordMessage(null);
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordMessage({ type: "error", text: "All password fields are required." });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMessage({ type: "error", text: "New password and confirmation do not match." });
      return;
    }
    if (newPassword.length < 6) {
      setPasswordMessage({ type: "error", text: "New password must be at least 6 characters." });
      return;
    }
    setSavingPassword(true);
    try {
      await actions.changeClientPassword(email, currentPassword, newPassword);
      setPasswordMessage({ type: "success", text: "Password changed successfully." });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      setPasswordMessage({ type: "error", text: "Failed to change password. Check your current password and try again." });
    }
    setSavingPassword(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
      </div>
    );
  }

  if (!account) {
    return (
      <div className="text-center py-16 text-slate-500">
        Unable to load account information.
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
        <Settings size={24} />
        Settings
      </h1>

      {/* Company Information */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
          <Building2 size={20} className="text-emerald-600" />
          Company Information
        </h2>

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              readOnly
              className={`${inputClass} bg-slate-50 cursor-not-allowed`}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Display Name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your display name"
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Company Name</label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Company name"
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Business address"
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Phone number"
              className={inputClass}
            />
          </div>
        </div>

        {infoMessage && (
          <div
            className={`text-sm px-4 py-2.5 rounded-lg ${
              infoMessage.type === "success"
                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                : "bg-red-50 text-red-700 border border-red-200"
            }`}
          >
            {infoMessage.text}
          </div>
        )}

        <button
          onClick={handleSaveInfo}
          disabled={savingInfo}
          className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
        >
          <Save size={16} />
          {savingInfo ? "Saving..." : "Save Changes"}
        </button>
      </div>

      {/* Change Password */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
          <KeyRound size={20} className="text-emerald-600" />
          Change Password
        </h2>

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Current Password</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Enter current password"
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new password"
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Confirm New Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              className={inputClass}
            />
          </div>
        </div>

        {passwordMessage && (
          <div
            className={`text-sm px-4 py-2.5 rounded-lg ${
              passwordMessage.type === "success"
                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                : "bg-red-50 text-red-700 border border-red-200"
            }`}
          >
            {passwordMessage.text}
          </div>
        )}

        <button
          onClick={handleChangePassword}
          disabled={savingPassword}
          className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
        >
          <KeyRound size={16} />
          {savingPassword ? "Changing..." : "Change Password"}
        </button>
      </div>
    </div>
  );
}
