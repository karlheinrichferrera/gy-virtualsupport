"use client";

import { useState, useEffect } from "react";
import * as actions from "@/lib/actions";
import type { AdminAccount } from "@/lib/actions";
import { Settings, KeyRound, Users, Plus, Trash2, AlertTriangle, X, Eye, EyeOff, RotateCcw } from "lucide-react";

export default function AdminSettingsPage() {
  const [currentUsername, setCurrentUsername] = useState("");
  const [admins, setAdmins] = useState<AdminAccount[]>([]);

  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwMsg, setPwMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);

  const [showAddAdmin, setShowAddAdmin] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newAdminPw, setNewAdminPw] = useState("gyadmin2026");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [addMsg, setAddMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<AdminAccount | null>(null);
  const [resetTarget, setResetTarget] = useState<AdminAccount | null>(null);

  useEffect(() => {
    const username = localStorage.getItem("adminUsername") || "admin";
    setCurrentUsername(username);
    loadAdmins();
  }, []);

  async function loadAdmins() {
    const list = await actions.getAdminAccounts();
    setAdmins(list);
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwMsg(null);
    if (newPw !== confirmPw) {
      setPwMsg({ type: "error", text: "New passwords do not match." });
      return;
    }
    if (newPw.length < 6) {
      setPwMsg({ type: "error", text: "Password must be at least 6 characters." });
      return;
    }
    const result = await actions.changeAdminPassword(currentUsername, currentPw, newPw);
    if (result.success) {
      setPwMsg({ type: "success", text: "Password changed successfully." });
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
    } else {
      setPwMsg({ type: "error", text: result.error || "Failed to change password." });
    }
  }

  async function handleAddAdmin(e: React.FormEvent) {
    e.preventDefault();
    setAddMsg(null);
    if (!newUsername.trim() || !newDisplayName.trim()) {
      setAddMsg({ type: "error", text: "Username and display name are required." });
      return;
    }
    const result = await actions.addAdminAccount(newUsername.trim(), newAdminPw, newDisplayName.trim());
    if (result.success) {
      setAddMsg({ type: "success", text: `Admin "${newUsername}" created successfully.` });
      setNewUsername("");
      setNewAdminPw("gyadmin2026");
      setNewDisplayName("");
      setShowAddAdmin(false);
      await loadAdmins();
    } else {
      setAddMsg({ type: "error", text: result.error || "Failed to create admin." });
    }
  }

  async function handleDeleteAdmin() {
    if (!deleteTarget) return;
    const result = await actions.deleteAdminAccount(deleteTarget.id);
    if (!result.success) {
      alert(result.error || "Cannot delete admin.");
    }
    setDeleteTarget(null);
    await loadAdmins();
  }

  async function handleResetAdmin() {
    if (!resetTarget) return;
    await actions.resetAdminPassword(resetTarget.id);
    setResetTarget(null);
  }

  const inputClass = "w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm";

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
        <Settings size={24} />
        Account Settings
      </h1>

      <div className="bg-card rounded-xl border border-border p-6">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2 mb-4">
          <KeyRound size={20} className="text-indigo-600" />
          Change Password
        </h2>
        <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Current Password</label>
            <div className="relative">
              <input
                type={showCurrentPw ? "text" : "password"}
                required
                value={currentPw}
                onChange={(e) => setCurrentPw(e.target.value)}
                className={inputClass}
                placeholder="Enter current password"
              />
              <button type="button" onClick={() => setShowCurrentPw((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                {showCurrentPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">New Password</label>
            <div className="relative">
              <input
                type={showNewPw ? "text" : "password"}
                required
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                className={inputClass}
                placeholder="Enter new password (min 6 chars)"
              />
              <button type="button" onClick={() => setShowNewPw((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                {showNewPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Confirm New Password</label>
            <input
              type="password"
              required
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              className={inputClass}
              placeholder="Re-enter new password"
            />
          </div>
          {pwMsg && (
            <p className={`text-sm px-3 py-2 rounded-lg ${pwMsg.type === "success" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
              {pwMsg.text}
            </p>
          )}
          <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors">
            Update Password
          </button>
        </form>
      </div>

      <div className="bg-card rounded-xl border border-border p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Users size={20} className="text-indigo-600" />
            Manage Admins
          </h2>
          <button
            onClick={() => { setShowAddAdmin(true); setAddMsg(null); }}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
          >
            <Plus size={16} /> Add Admin
          </button>
        </div>

        {addMsg && (
          <p className={`text-sm px-3 py-2 rounded-lg mb-4 ${addMsg.type === "success" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
            {addMsg.text}
          </p>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-border">
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Username</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Display Name</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Created</th>
                <th className="text-center px-4 py-3 font-semibold text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {admins.map((admin) => (
                <tr key={admin.id} className="border-b border-border hover:bg-slate-50/50">
                  <td className="px-4 py-3 font-medium text-foreground">{admin.username}</td>
                  <td className="px-4 py-3 text-foreground">{admin.displayName}</td>
                  <td className="px-4 py-3 text-muted">{admin.createdAt}</td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => setResetTarget(admin)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-amber-600 bg-amber-50 rounded-lg hover:bg-amber-100 transition-colors"
                      >
                        <RotateCcw size={14} /> Reset PW
                      </button>
                      {admin.username !== currentUsername && (
                        <button
                          onClick={() => setDeleteTarget(admin)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                        >
                          <Trash2 size={14} /> Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showAddAdmin && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Plus size={20} className="text-indigo-600" /> Add Admin Account
              </h3>
              <button onClick={() => setShowAddAdmin(false)} className="p-1 hover:bg-slate-100 rounded-lg">
                <X size={20} className="text-slate-500" />
              </button>
            </div>
            <form onSubmit={handleAddAdmin} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Username *</label>
                <input type="text" required value={newUsername} onChange={(e) => setNewUsername(e.target.value)} className={inputClass} placeholder="e.g. admin2" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Display Name *</label>
                <input type="text" required value={newDisplayName} onChange={(e) => setNewDisplayName(e.target.value)} className={inputClass} placeholder="e.g. John Admin" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Password</label>
                <input type="text" value={newAdminPw} onChange={(e) => setNewAdminPw(e.target.value)} className={inputClass} />
                <p className="text-xs text-slate-400 mt-1">Default: gyadmin2026</p>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowAddAdmin(false)} className="flex-1 border border-slate-300 text-slate-700 font-medium py-2.5 rounded-lg hover:bg-slate-50 transition-colors text-sm">Cancel</button>
                <button type="submit" className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm">
                  <Plus size={16} /> Create Admin
                </button>
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
              <h3 className="text-lg font-bold text-slate-900">Delete Admin Account</h3>
              <p className="text-sm text-slate-600">
                Are you sure you want to delete admin <strong>{deleteTarget.username}</strong> ({deleteTarget.displayName})? This action cannot be undone.
              </p>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setDeleteTarget(null)} className="flex-1 border border-slate-300 text-slate-700 font-medium py-2.5 rounded-lg hover:bg-slate-50 transition-colors text-sm">Cancel</button>
                <button onClick={handleDeleteAdmin} className="flex-1 bg-red-600 hover:bg-red-700 text-white font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm">
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
              <div className="w-14 h-14 bg-amber-100 rounded-full flex items-center justify-center mx-auto">
                <KeyRound className="text-amber-600" size={28} />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Reset Password</h3>
              <p className="text-sm text-slate-600">
                Reset the password for <strong>{resetTarget.username}</strong> ({resetTarget.displayName}) to the default password <strong>gyadmin2026</strong>?
              </p>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setResetTarget(null)} className="flex-1 border border-slate-300 text-slate-700 font-medium py-2.5 rounded-lg hover:bg-slate-50 transition-colors text-sm">Cancel</button>
                <button onClick={handleResetAdmin} className="flex-1 bg-amber-600 hover:bg-amber-700 text-white font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm">
                  <KeyRound size={16} /> Reset
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
