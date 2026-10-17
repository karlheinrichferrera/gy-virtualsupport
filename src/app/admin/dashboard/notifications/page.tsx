"use client";

import { useEffect, useState } from "react";
import { Bell, Plus, Trash2, Send, Users, User } from "lucide-react";
import { getAllNotifications, createNotification, deleteNotification, getProfiles } from "@/lib/actions";

type Notif = {
  id: number;
  vaId: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
  createdBy: string;
};

type VA = { id: string; firstName: string; lastName: string };

export default function AdminNotificationsPage() {
  const [notifications, setNotifications] = useState<Notif[]>([]);
  const [vas, setVas] = useState<VA[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [target, setTarget] = useState("");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);

  const load = async () => {
    const [notifs, profiles] = await Promise.all([
      getAllNotifications(),
      getProfiles(),
    ]);
    setNotifications(notifs as Notif[]);
    setVas(profiles.map(p => ({ id: p.id, firstName: p.firstName, lastName: p.lastName })));
  };

  useEffect(() => { load(); }, []);

  const handleSend = async () => {
    if (!title.trim() || !message.trim()) return;
    setSending(true);
    const adminName = localStorage.getItem("adminDisplayName") || localStorage.getItem("adminUsername") || "admin";
    await createNotification({ vaId: target, title: title.trim(), message: message.trim(), type: "admin", createdBy: adminName });
    setTitle("");
    setMessage("");
    setTarget("");
    setShowForm(false);
    setSending(false);
    load();
  };

  const handleDelete = async (id: number) => {
    setDeleting(id);
    await deleteNotification(id);
    setDeleting(null);
    load();
  };

  const getTargetLabel = (vaId: string) => {
    if (!vaId) return "All VAs";
    const va = vas.find(v => v.id === vaId);
    return va ? `${va.firstName} ${va.lastName} (${va.id})` : vaId;
  };

  const typeColors: Record<string, string> = {
    reminder: "bg-amber-100 text-amber-800 border-amber-200",
    admin: "bg-indigo-100 text-indigo-800 border-indigo-200",
    general: "bg-gray-100 text-gray-800 border-gray-200",
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
            <Bell size={20} className="text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Notifications</h1>
            <p className="text-sm text-muted">Send notifications to your VAs</p>
          </div>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
        >
          <Plus size={16} />
          New Notification
        </button>
      </div>

      {showForm && (
        <div className="bg-card border border-border rounded-xl p-6 space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Create Notification</h2>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Send To</label>
            <select
              value={target}
              onChange={e => setTarget(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm"
            >
              <option value="">All VAs</option>
              {vas.map(va => (
                <option key={va.id} value={va.id}>{va.firstName} {va.lastName} ({va.id})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Important Announcement"
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Message</label>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              rows={3}
              placeholder="Write your notification message..."
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm resize-none"
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={handleSend}
              disabled={sending || !title.trim() || !message.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors text-sm font-medium"
            >
              <Send size={14} />
              {sending ? "Sending..." : "Send Notification"}
            </button>
            <button
              onClick={() => { setShowForm(false); setTitle(""); setMessage(""); setTarget(""); }}
              className="px-4 py-2 text-sm text-muted hover:text-foreground transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="font-semibold text-foreground">All Notifications ({notifications.length})</h2>
        </div>

        {notifications.length === 0 ? (
          <div className="p-12 text-center text-muted text-sm">No notifications created yet</div>
        ) : (
          <div className="divide-y divide-border">
            {notifications.map(n => (
              <div key={n.id} className="px-6 py-4 hover:bg-background/50 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${typeColors[n.type] || typeColors.general}`}>
                        {n.type.toUpperCase()}
                      </span>
                      <span className="flex items-center gap-1 text-[11px] text-muted">
                        {n.vaId ? <User size={10} /> : <Users size={10} />}
                        {getTargetLabel(n.vaId)}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-foreground">{n.title}</p>
                    <p className="text-xs text-muted mt-0.5">{n.message}</p>
                    <p className="text-[10px] text-muted mt-1.5">
                      Created {n.createdAt} by {n.createdBy}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDelete(n.id)}
                    disabled={deleting === n.id}
                    className="p-2 text-muted hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                    title="Delete notification"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
