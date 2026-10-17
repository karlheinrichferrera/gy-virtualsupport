"use client";

import { useState, useEffect, useRef } from "react";
import { Bell, X, Check, CheckCheck } from "lucide-react";
import { getNotifications, getUnreadNotificationCount, markNotificationRead, markAllNotificationsRead } from "@/lib/actions";

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

export default function NotificationBell({ vaId }: { vaId: string }) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notif[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  const load = async () => {
    const [notifs, count] = await Promise.all([
      getNotifications(vaId),
      getUnreadNotificationCount(vaId),
    ]);
    setNotifications(notifs as Notif[]);
    setUnreadCount(count);
  };

  useEffect(() => {
    if (vaId) load();
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, [vaId]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleMarkRead = async (id: number) => {
    await markNotificationRead(id, vaId);
    load();
  };

  const handleMarkAllRead = async () => {
    await markAllNotificationsRead(vaId);
    load();
  };

  const typeColors: Record<string, string> = {
    reminder: "bg-amber-100 text-amber-700",
    admin: "bg-blue-100 text-blue-700",
    general: "bg-gray-100 text-gray-700",
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => { setOpen(!open); if (!open) load(); }}
        className="relative p-2 hover:bg-background rounded-lg transition-colors"
      >
        <Bell size={20} className="text-muted" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-card border border-border rounded-xl shadow-2xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
            <h3 className="font-semibold text-foreground">Notifications</h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button onClick={handleMarkAllRead} className="text-xs text-primary hover:underline flex items-center gap-1">
                  <CheckCheck size={14} /> Mark all read
                </button>
              )}
              <button onClick={() => setOpen(false)} className="p-1 hover:bg-background rounded">
                <X size={16} className="text-muted" />
              </button>
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-muted text-sm">No notifications yet</div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={`px-4 py-3 border-b border-border last:border-0 transition-colors ${!n.isRead ? "bg-blue-50/50" : ""}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${typeColors[n.type] || typeColors.general}`}>
                          {n.type === "reminder" ? "REMINDER" : n.type === "admin" ? "ADMIN" : "GENERAL"}
                        </span>
                        {!n.isRead && <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />}
                      </div>
                      <p className="text-sm font-medium text-foreground">{n.title}</p>
                      <p className="text-xs text-muted mt-0.5 line-clamp-2">{n.message}</p>
                      <p className="text-[10px] text-muted mt-1">{n.createdAt}</p>
                    </div>
                    {!n.isRead && (
                      <button onClick={() => handleMarkRead(n.id)} className="p-1 hover:bg-background rounded flex-shrink-0" title="Mark as read">
                        <Check size={14} className="text-muted" />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
