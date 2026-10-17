"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Bell, X, Check, CheckCheck, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  getClientNotifications,
  markClientNotificationRead,
  markAllClientNotificationsRead,
} from "@/lib/actions";
import type { Notification } from "@/lib/notification-types";

type NotificationBellProps =
  | { vaId: string; clientEmail?: never }
  | { clientEmail: string; vaId?: never };

const typeColors: Record<string, string> = {
  reminder: "bg-amber-100 text-amber-700",
  admin: "bg-blue-100 text-blue-700",
  general: "bg-gray-100 text-gray-700",
};

export default function NotificationBell({ vaId, clientEmail }: NotificationBellProps) {
  const router = useRouter();
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const active = useRef(false);
  const loadVersion = useRef(0);
  const isClient = clientEmail !== undefined;
  const recipient = clientEmail ?? vaId ?? "";
  const unreadCount = notifications.filter((item) => !item.isRead).length;

  const load = useCallback(async () => {
    if (!recipient) return;
    const version = ++loadVersion.current;
    try {
      const items = isClient
        ? await getClientNotifications(recipient)
        : await getNotifications(recipient);
      if (!active.current || version !== loadVersion.current) return;
      setNotifications(items);
      setError("");
    } catch {
      if (active.current && version === loadVersion.current) {
        setError("Notifications could not be loaded. Please try again.");
      }
    } finally {
      if (active.current && version === loadVersion.current) setLoading(false);
    }
  }, [isClient, recipient]);

  useEffect(() => {
    active.current = true;
    // Cancel the first fetch if React immediately remounts this effect.
    const initialLoad = window.setTimeout(() => {
      setNotifications([]);
      setExpandedId(null);
      setLoading(true);
      void load();
    }, 0);
    const interval = window.setInterval(() => { void load(); }, 60000);
    return () => {
      active.current = false;
      loadVersion.current += 1;
      window.clearTimeout(initialLoad);
      window.clearInterval(interval);
    };
  }, [load]);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const handleClick = (event: PointerEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("pointerdown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  const markRead = async (notification: Notification) => {
    if (notification.isRead) return;
    if (isClient) await markClientNotificationRead(notification.id, recipient);
    else await markNotificationRead(notification.id, recipient);
    if (!active.current) return;
    // Prevent an older poll from replacing the newly updated read state.
    loadVersion.current += 1;
    setLoading(false);
    setNotifications((items) => items.map((item) => item.id === notification.id ? { ...item, isRead: true } : item));
  };

  const handleNotification = async (notification: Notification, expand: boolean) => {
    if (pending) return;
    setPending(true);
    setError("");
    try {
      await markRead(notification);
      if (!active.current) return;
      if (expand) {
        const path = notification.redirectTo;
        // Only navigate to paths within this recipient's portal.
        const portal = isClient ? "/client/dashboard" : "/dashboard";
        if (path && !/[\\\u0000-\u001f]/.test(path)
          && (path === portal || path.startsWith(`${portal}/`) || path.startsWith(`${portal}?`) || path.startsWith(`${portal}#`))) {
          setOpen(false);
          router.push(path);
        } else {
          setExpandedId((id) => id === notification.id ? null : notification.id);
        }
      }
    } catch {
      if (active.current) setError("The notification could not be marked as read. Please try again.");
    } finally {
      if (active.current) setPending(false);
    }
  };

  const handleMarkAllRead = async () => {
    if (pending) return;
    setPending(true);
    setError("");
    try {
      if (isClient) await markAllClientNotificationsRead(recipient);
      else await markAllNotificationsRead(recipient);
      if (!active.current) return;
      loadVersion.current += 1;
      setLoading(false);
      setNotifications((items) => items.map((item) => ({ ...item, isRead: true })));
    } catch {
      if (active.current) setError("Notifications could not be marked as read. Please try again.");
    } finally {
      if (active.current) setPending(false);
    }
  };

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        ref={triggerRef}
        type="button"
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => { setOpen(!open); if (!open) { setLoading(true); void load(); } }}
        className="relative rounded-lg p-2 transition-colors hover:bg-background focus-visible:outline-2 focus-visible:outline-primary"
      >
        <Bell size={20} className="text-muted" aria-hidden="true" />
        {unreadCount > 0 && (
          <span aria-hidden="true" className="absolute -top-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div id={panelId} role="dialog" aria-labelledby={`${panelId}-title`} className="fixed inset-x-3 top-16 z-50 flex max-h-[calc(100dvh-5rem)] flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl sm:absolute sm:inset-x-auto sm:top-full sm:right-0 sm:mt-2 sm:w-96 sm:max-w-[calc(100vw-1.5rem)]">
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-gray-200 bg-gray-50 px-4 py-3">
            <h3 id={`${panelId}-title`} className="font-semibold text-gray-900">Notifications</h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button type="button" disabled={pending} onClick={() => { void handleMarkAllRead(); }} className="flex items-center gap-1 text-xs text-blue-600 hover:underline disabled:opacity-50">
                  <CheckCheck size={14} aria-hidden="true" /> Mark all read
                </button>
              )}
              <button ref={closeRef} type="button" aria-label="Close notifications" onClick={() => { setOpen(false); triggerRef.current?.focus(); }} className="rounded p-1 hover:bg-gray-200">
                <X size={16} className="text-gray-500" aria-hidden="true" />
              </button>
            </div>
          </div>

          {error && (
            <div role="alert" className="shrink-0 border-b border-red-100 bg-red-50 px-4 py-3 text-xs text-red-700">
              {error} <button type="button" onClick={() => { setLoading(true); void load(); }} disabled={loading || pending} className="font-semibold underline disabled:opacity-50">Retry</button>
            </div>
          )}

          <div className="min-h-0 max-h-96 overflow-y-auto overscroll-contain" aria-busy={loading || pending}>
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-500">{loading ? "Loading notifications…" : error ? "Notifications are unavailable." : "No notifications yet"}</div>
            ) : (
              <ul>
                {notifications.map((notification) => {
                  const isExpanded = expandedId === notification.id;
                  return (
                    <li key={notification.id} className={`flex items-start border-b border-gray-100 last:border-0 ${notification.isRead ? "bg-white" : "bg-blue-50"}`}>
                      <button type="button" disabled={pending} aria-expanded={notification.redirectTo ? undefined : isExpanded} onClick={() => { void handleNotification(notification, true); }} className="min-w-0 flex-1 px-4 py-3 text-left transition-colors hover:bg-gray-50 disabled:opacity-60">
                        <span className="mb-1 flex items-center gap-2">
                          <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${typeColors[notification.type] || typeColors.general}`}>
                            {notification.type === "reminder" ? "REMINDER" : notification.type === "admin" ? "ADMIN" : "GENERAL"}
                          </span>
                          {!notification.isRead && <span className="h-2 w-2 shrink-0 rounded-full bg-blue-500"><span className="sr-only">Unread</span></span>}
                        </span>
                        <span className="block break-words text-sm font-medium text-gray-900">{notification.title}</span>
                        {notification.imageUrl && (
                          <Image src={notification.imageUrl} alt={`Image for ${notification.title}`} width={640} height={320} unoptimized className={`mt-2 w-full rounded-lg object-contain ${isExpanded ? "max-h-64" : "max-h-32"}`} />
                        )}
                        <span className={`mt-0.5 whitespace-pre-wrap break-words text-xs text-gray-600 ${isExpanded ? "block" : "line-clamp-2"}`}>{notification.message}</span>
                        <span className="mt-1.5 flex flex-wrap items-center justify-between gap-1">
                          <span className="text-[10px] text-gray-400">{notification.createdAt}</span>
                          {notification.redirectTo ? (
                            <span className="flex items-center gap-0.5 text-[10px] text-blue-600">Open page <ExternalLink size={10} aria-hidden="true" /></span>
                          ) : (
                            <span className="flex items-center gap-0.5 text-[10px] text-blue-600">
                              {isExpanded ? <><ChevronUp size={10} aria-hidden="true" /> Less</> : <><ChevronDown size={10} aria-hidden="true" /> More</>}
                            </span>
                          )}
                        </span>
                      </button>
                      {!notification.isRead && (
                        <button type="button" disabled={pending} onClick={() => { void handleNotification(notification, false); }} className="mt-3 mr-3 shrink-0 rounded p-1 hover:bg-gray-200 disabled:opacity-50" aria-label={`Mark ${notification.title} as read`} title="Mark as read">
                          <Check size={14} className="text-gray-500" aria-hidden="true" />
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <p className="shrink-0 border-t border-gray-100 px-4 py-2 text-[10px] text-gray-500">Read notifications are automatically removed after 24 hours.</p>
        </div>
      )}
    </div>
  );
}
