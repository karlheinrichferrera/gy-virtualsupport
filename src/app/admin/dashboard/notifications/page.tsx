"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { Bell, Plus, Trash2, Send, Users, User, CalendarClock, Repeat, ImagePlus, X } from "lucide-react";
import {
  getAllNotifications,
  createNotification,
  deleteNotification,
  deleteNotificationSchedule,
  getProfiles,
  getClientAccounts,
  beginNotificationImageUpload,
  uploadNotificationImageChunk,
} from "@/lib/actions";
import type { Notification, NotificationInput } from "@/lib/notification-types";
import { NOTIFICATION_IMAGE_MAX_BYTES, NOTIFICATION_IMAGE_CHUNK_BASE64_LENGTH } from "@/lib/notification-image";

type VA = { id: string; firstName: string; lastName: string };
type Client = { id: number; displayName: string; companyName: string; email: string };
type Delivery = "now" | "scheduled" | "recurring";
type Recurrence = NonNullable<NotificationInput["recurrence"]>;

const inputClass = "w-full min-w-0 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground disabled:opacity-60";
const recurrenceLabels: Record<Recurrence, string> = {
  none: "One time",
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  yearly: "Yearly",
};

function dateLabel(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export default function AdminNotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [vas, setVas] = useState<VA[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [formError, setFormError] = useState("");
  const [success, setSuccess] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [audience, setAudience] = useState<"va" | "client">("va");
  const [target, setTarget] = useState("");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [delivery, setDelivery] = useState<Delivery>("now");
  const [recurrence, setRecurrence] = useState<Recurrence>("weekly");
  const [startsAt, setStartsAt] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [redirectTo, setRedirectTo] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [imageLoading, setImageLoading] = useState(false);
  const [imageUploadProgress, setImageUploadProgress] = useState<{ completed: number; total: number } | null>(null);
  const [sending, setSending] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const imageReadVersion = useRef(0);
  const uploadedImage = useRef<{ imageUrl: string; id: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const [notifs, profiles, accounts] = await Promise.all([
        getAllNotifications(),
        getProfiles(),
        getClientAccounts(),
      ]);
      setNotifications(notifs);
      setVas(profiles.map(profile => ({ id: profile.id, firstName: profile.firstName, lastName: profile.lastName })));
      setClients(accounts.map(client => ({ id: client.id, displayName: client.displayName, companyName: client.companyName, email: client.email })));
      setLoadError("");
    } catch (error) {
      setLoadError(errorMessage(error, "Could not load notifications. Please try again."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const clearImage = () => {
    imageReadVersion.current += 1;
    uploadedImage.current = null;
    setImageUrl("");
    setImageLoading(false);
    setImageUploadProgress(null);
    if (imageInput.current) imageInput.current.value = "";
  };

  const resetForm = () => {
    setTitle("");
    setMessage("");
    setAudience("va");
    setTarget("");
    setDelivery("now");
    setRecurrence("weekly");
    setStartsAt("");
    setExpiresAt("");
    setRedirectTo("");
    setFormError("");
    clearImage();
  };

  const handleImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const readVersion = ++imageReadVersion.current;
    uploadedImage.current = null;
    setFormError("");
    if (!["image/jpeg", "image/png", "image/gif", "image/webp"].includes(file.type)) {
      setFormError("Choose a PNG, JPEG, GIF, or WebP image.");
      clearImage();
      return;
    }
    if (file.size > NOTIFICATION_IMAGE_MAX_BYTES) {
      setFormError("The image must be 10 MB or smaller. Resize it and try again.");
      clearImage();
      return;
    }
    setImageLoading(true);
    try {
      const result = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Could not read this image."));
        reader.onerror = () => reject(new Error("Could not read this image. Please choose it again."));
        reader.readAsDataURL(file);
      });
      if (readVersion === imageReadVersion.current) setImageUrl(result);
    } catch (error) {
      if (readVersion === imageReadVersion.current) {
        setFormError(errorMessage(error, "Could not read this image."));
        clearImage();
      }
    } finally {
      if (readVersion === imageReadVersion.current) setImageLoading(false);
    }
  };

  const handleSend = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (sending || imageLoading) return;
    setFormError("");
    setSuccess("");
    if (!title.trim() || !message.trim()) {
      setFormError("Enter a title and message.");
      return;
    }
    const firstDelivery = delivery === "now" ? new Date() : new Date(startsAt);
    if (Number.isNaN(firstDelivery.getTime()) || (delivery !== "now" && firstDelivery.getTime() <= Date.now())) {
      setFormError("Choose a future date and time for the first delivery.");
      return;
    }
    const expiration = expiresAt ? new Date(expiresAt) : null;
    if (expiration && (Number.isNaN(expiration.getTime()) || expiration <= firstDelivery)) {
      setFormError("The expiration must be after the first delivery.");
      return;
    }
    const destination = redirectTo.trim();
    const portalRoot = audience === "client" ? "/client/dashboard" : "/dashboard";
    let validDestination = !destination;
    if (destination.startsWith("/") && !destination.startsWith("//") && !/[\\\u0000-\u0020]/.test(destination)) {
      try {
        const path = new URL(destination, window.location.origin).pathname;
        validDestination = path === portalRoot || path.startsWith(`${portalRoot}/`);
      } catch {
        validDestination = false;
      }
    }
    if (!validDestination) {
      setFormError(`Enter a page in the recipient's portal, starting with ${portalRoot}.`);
      return;
    }
    setSending(true);
    try {
      let imageUploadId: string | null = null;
      if (imageUrl) {
        if (uploadedImage.current?.imageUrl === imageUrl) {
          imageUploadId = uploadedImage.current.id;
        } else {
          const commaIndex = imageUrl.indexOf(",");
          const contentType = imageUrl.slice(5, imageUrl.indexOf(";"));
          const base64 = imageUrl.slice(commaIndex + 1);
          const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
          const size = base64.length * 3 / 4 - padding;
          const total = Math.ceil(base64.length / NOTIFICATION_IMAGE_CHUNK_BASE64_LENGTH);
          setImageUploadProgress({ completed: 0, total });
          const upload = await beginNotificationImageUpload({ contentType, size });
          for (let index = 0; index < total; index += 1) {
            const start = index * NOTIFICATION_IMAGE_CHUNK_BASE64_LENGTH;
            await uploadNotificationImageChunk(upload.id, index, base64.slice(start, start + NOTIFICATION_IMAGE_CHUNK_BASE64_LENGTH));
            setImageUploadProgress({ completed: index + 1, total });
          }
          imageUploadId = upload.id;
          uploadedImage.current = { imageUrl, id: upload.id };
          setImageUploadProgress(null);
        }
      }
      const adminName = localStorage.getItem("adminDisplayName") || localStorage.getItem("adminUsername") || "admin";
      await createNotification({
        audience,
        vaId: audience === "va" ? target : "",
        clientId: audience === "client" && target ? Number(target) : null,
        title: title.trim(),
        message: message.trim(),
        imageUrl: "",
        imageUploadId,
        redirectTo: destination,
        startsAt: delivery === "now" ? null : firstDelivery.toISOString(),
        expiresAt: expiration?.toISOString() || null,
        recurrence: delivery === "recurring" ? recurrence : "none",
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        type: "admin",
        createdBy: adminName,
      });
      setSuccess(delivery === "now" ? "Notification sent." : delivery === "recurring" ? "Recurring notification scheduled." : "Notification scheduled.");
      resetForm();
      setShowForm(false);
      setLoading(true);
      await load();
    } catch (error) {
      setFormError(errorMessage(error, "Could not save this notification. Please try again."));
    } finally {
      setImageUploadProgress(null);
      setSending(false);
    }
  };

  const handleDelete = async (notification: Notification) => {
    const key = notification.scheduleId ? `schedule-${notification.scheduleId}` : `notification-${notification.id}`;
    if (notification.scheduleId && !window.confirm("Delete this schedule and its notifications? Future deliveries will stop.")) return;
    setDeleting(key);
    setSuccess("");
    setFormError("");
    try {
      if (notification.scheduleId) await deleteNotificationSchedule(notification.scheduleId);
      else await deleteNotification(notification.id);
      setSuccess(notification.scheduleId ? "Notification schedule deleted." : "Notification deleted.");
      await load();
    } catch (error) {
      setLoadError(errorMessage(error, "Could not delete the notification. Please try again."));
    } finally {
      setDeleting(null);
    }
  };

  const getTargetLabel = (notification: Notification) => {
    if (notification.audience === "client") {
      if (!notification.clientId) return "All clients";
      const client = clients.find(item => item.id === notification.clientId);
      return client ? `${client.displayName || client.email}${client.companyName ? ` · ${client.companyName}` : ""}` : `Client #${notification.clientId}`;
    }
    if (!notification.vaId) return "All VAs";
    const va = vas.find(item => item.id === notification.vaId);
    return va ? `${va.firstName} ${va.lastName} (${va.id})` : notification.vaId;
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-100">
            <Bell size={20} className="text-indigo-600" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-foreground">Notifications</h1>
            <p className="text-sm text-muted">Send announcements and greetings to VAs and clients</p>
          </div>
        </div>
        <button
          onClick={() => { setShowForm(!showForm); setFormError(""); setSuccess(""); }}
          disabled={sending}
          aria-expanded={showForm}
          aria-controls="notification-form"
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
        >
          <Plus size={16} aria-hidden="true" />
          New Notification
        </button>
      </div>

      {success && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{success}</p>}
      {loadError && (
        <div role="alert" className="space-y-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <p>{loadError}</p>
          <button type="button" onClick={() => { setLoading(true); void load(); }} disabled={loading} className="font-semibold underline disabled:opacity-50">{loading ? "Retrying..." : "Try again"}</button>
        </div>
      )}

      {showForm && (
        <form id="notification-form" onSubmit={handleSend} className="space-y-5 rounded-xl border border-border bg-card p-4 sm:p-6">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Create Notification</h2>
            <p className="mt-1 text-xs text-muted">Read notifications disappear from each recipient&apos;s portal after 24 hours. An earlier expiration takes priority.</p>
          </div>
          {formError && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{formError}</p>}
          <fieldset disabled={sending} className="min-w-0 space-y-5 disabled:opacity-70">
            <legend className="sr-only">Notification details</legend>
            <div className="grid min-w-0 gap-4 sm:grid-cols-2">
              <div className="min-w-0">
                <label htmlFor="notification-audience" className="mb-1 block text-sm font-medium text-foreground">Audience</label>
                <select id="notification-audience" value={audience} onChange={event => { setAudience(event.target.value as "va" | "client"); setTarget(""); setRedirectTo(""); }} className={inputClass}>
                  <option value="va">Virtual assistants</option>
                  <option value="client">Clients</option>
                </select>
              </div>
              <div className="min-w-0">
                <label htmlFor="notification-recipient" className="mb-1 block text-sm font-medium text-foreground">Send to</label>
                <select id="notification-recipient" value={target} onChange={event => setTarget(event.target.value)} disabled={loading || Boolean(loadError)} className={inputClass}>
                  <option value="">{audience === "va" ? "All VAs" : "All clients"}</option>
                  {audience === "va"
                    ? vas.map(va => <option key={va.id} value={va.id}>{va.firstName} {va.lastName} ({va.id})</option>)
                    : clients.map(client => <option key={client.id} value={client.id}>{client.displayName || client.email}{client.companyName ? ` · ${client.companyName}` : ""}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label htmlFor="notification-title" className="mb-1 block text-sm font-medium text-foreground">Title</label>
              <input id="notification-title" required maxLength={200} value={title} onChange={event => setTitle(event.target.value)} placeholder="e.g. Happy work anniversary!" className={inputClass} />
            </div>
            <div>
              <label htmlFor="notification-message" className="mb-1 block text-sm font-medium text-foreground">Message</label>
              <textarea id="notification-message" required maxLength={10000} value={message} onChange={event => setMessage(event.target.value)} rows={4} placeholder="Write your notification message..." className={`${inputClass} resize-y`} />
            </div>
            <div className="grid min-w-0 gap-4 sm:grid-cols-2">
              <div className="min-w-0">
                <label htmlFor="notification-delivery" className="mb-1 block text-sm font-medium text-foreground">Delivery</label>
                <select id="notification-delivery" value={delivery} onChange={event => setDelivery(event.target.value as Delivery)} className={inputClass}>
                  <option value="now">One time · send now</option>
                  <option value="scheduled">One time · schedule for later</option>
                  <option value="recurring">Recurring</option>
                </select>
              </div>
              {delivery === "recurring" && (
                <div className="min-w-0">
                  <label htmlFor="notification-recurrence" className="mb-1 block text-sm font-medium text-foreground">Repeat</label>
                  <select id="notification-recurrence" value={recurrence} onChange={event => setRecurrence(event.target.value as Recurrence)} className={inputClass}>
                    {(["daily", "weekly", "monthly", "yearly"] as const).map(option => <option key={option} value={option}>{recurrenceLabels[option]}</option>)}
                  </select>
                </div>
              )}
              {delivery !== "now" && (
                <div className="min-w-0">
                  <label htmlFor="notification-starts" className="mb-1 block text-sm font-medium text-foreground">{delivery === "recurring" ? "First delivery" : "Delivery date and time"}</label>
                  <input id="notification-starts" type="datetime-local" required value={startsAt} onChange={event => setStartsAt(event.target.value)} className={inputClass} aria-describedby="notification-timezone" />
                </div>
              )}
              <div className="min-w-0">
                <label htmlFor="notification-expiration" className="mb-1 block text-sm font-medium text-foreground">Expiration date and time <span className="font-normal text-muted">(optional)</span></label>
                <input id="notification-expiration" type="datetime-local" value={expiresAt} onChange={event => setExpiresAt(event.target.value)} className={inputClass} aria-describedby="notification-expiration-help notification-timezone" />
                <p id="notification-expiration-help" className="mt-1 text-xs text-muted">{delivery === "recurring" ? "Stops future deliveries and removes remaining notifications at this time." : "Removes this notification for every recipient at this time."}</p>
              </div>
            </div>
            <p id="notification-timezone" className="text-xs text-muted">Choose dates and times in your device&apos;s local time zone. Recurring deliveries keep the same local time.</p>
            <div>
              <label htmlFor="notification-redirect" className="mb-1 block text-sm font-medium text-foreground">Redirect to <span className="font-normal text-muted">(optional)</span></label>
              <input id="notification-redirect" value={redirectTo} onChange={event => setRedirectTo(event.target.value)} placeholder={audience === "client" ? "/client/dashboard/invoices" : "/dashboard/calendar"} className={inputClass} aria-describedby="notification-redirect-help" />
              <p id="notification-redirect-help" className="mt-1 text-xs text-muted">Enter a page path in the {audience === "client" ? "client" : "VA"} portal. The notification opens this page when clicked.</p>
            </div>
            <div className="space-y-2">
              <label htmlFor="notification-image" className="flex items-center gap-2 text-sm font-medium text-foreground"><ImagePlus size={16} aria-hidden="true" /> Image <span className="font-normal text-muted">(optional)</span></label>
              <input id="notification-image" ref={imageInput} type="file" accept="image/png,image/jpeg,image/gif,image/webp" onChange={handleImage} className={`${inputClass} file:mr-3 file:rounded file:border-0 file:bg-indigo-50 file:px-2 file:py-1 file:text-indigo-700`} aria-describedby="notification-image-help" />
              <p id="notification-image-help" className="text-xs text-muted">PNG, JPEG, GIF, or WebP up to 10 MB. Great for birthday and anniversary greetings.</p>
              {imageLoading && <p role="status" className="text-xs text-muted">Reading image...</p>}
              {imageUploadProgress && <p role="status" className="text-xs text-muted">Uploading image: {Math.round(imageUploadProgress.completed / imageUploadProgress.total * 100)}%</p>}
              {imageUrl && (
                <div className="flex flex-wrap items-start gap-3 rounded-lg border border-border p-3">
                  {/* Uploaded image data is displayed directly without an external image service. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imageUrl} alt="Notification image preview" className="max-h-48 max-w-full rounded-lg object-contain" />
                  <button type="button" onClick={clearImage} className="flex items-center gap-1 rounded-lg px-2 py-1 text-sm text-red-600 hover:bg-red-50"><X size={14} aria-hidden="true" /> Remove image</button>
                </div>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button type="submit" disabled={loading || Boolean(loadError) || sending || imageLoading || !title.trim() || !message.trim()} className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50">
                {delivery === "now" ? <Send size={14} aria-hidden="true" /> : <CalendarClock size={14} aria-hidden="true" />}
                {sending ? imageUploadProgress ? `Uploading ${Math.round(imageUploadProgress.completed / imageUploadProgress.total * 100)}%...` : "Saving..." : delivery === "now" ? "Send Notification" : "Schedule Notification"}
              </button>
              <button type="button" onClick={() => { resetForm(); setShowForm(false); }} className="rounded-lg px-4 py-2 text-sm text-muted transition-colors hover:text-foreground">Cancel</button>
            </div>
          </fieldset>
        </form>
      )}

      <div className="overflow-hidden rounded-xl border border-border bg-card" aria-busy={loading}>
        <div className="border-b border-border px-4 py-4 sm:px-6">
          <h2 className="font-semibold text-foreground">All Notifications ({notifications.length})</h2>
        </div>
        {loading ? (
          <div role="status" className="p-8 text-center text-sm text-muted">Loading notifications...</div>
        ) : notifications.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted">{loadError ? "Notifications are unavailable. Use Try again above to reload." : "No notifications created yet"}</div>
        ) : (
          <div className="divide-y divide-border">
            {notifications.map(notification => {
              const deleteKey = notification.scheduleId ? `schedule-${notification.scheduleId}` : `notification-${notification.id}`;
              const isScheduled = notification.status === "scheduled";
              return (
                <div key={`${isScheduled ? "schedule" : "notification"}-${notification.id}`} className="px-4 py-4 transition-colors hover:bg-background/50 sm:px-6">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="rounded border border-indigo-200 bg-indigo-100 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-800">{notification.audience === "client" ? "CLIENT" : "VA"}</span>
                        <span className="flex min-w-0 items-center gap-1 text-xs text-muted">
                          {notification.vaId || notification.clientId ? <User size={12} className="shrink-0" aria-hidden="true" /> : <Users size={12} className="shrink-0" aria-hidden="true" />}
                          <span className="break-words">{getTargetLabel(notification)}</span>
                        </span>
                        {isScheduled && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">SCHEDULED</span>}
                      </div>
                      <div>
                        <p className="break-words text-sm font-medium text-foreground">{notification.title}</p>
                        <p className="mt-1 whitespace-pre-wrap break-words text-sm text-muted">{notification.message}</p>
                      </div>
                      {notification.imageUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={notification.imageUrl} alt={`${notification.title} greeting image`} loading="lazy" className="max-h-40 max-w-full rounded-lg object-contain" />
                      )}
                      <div className="space-y-1 text-xs text-muted">
                        {notification.recurrence !== "none" && <p className="flex items-center gap-1"><Repeat size={12} aria-hidden="true" /> {recurrenceLabels[notification.recurrence]}</p>}
                        {notification.scheduledFor && <p>{isScheduled ? "Next delivery" : "Delivered"}: {dateLabel(notification.scheduledFor)}</p>}
                        {notification.expiresAt && <p>Expires: {dateLabel(notification.expiresAt)}</p>}
                        {notification.redirectTo && <p className="break-all">Opens: <a href={notification.redirectTo} className="text-indigo-600 underline">{notification.redirectTo}</a></p>}
                        <p>Created {dateLabel(notification.createdAt)} by {notification.createdBy || "admin"}</p>
                      </div>
                    </div>
                    <button type="button" onClick={() => void handleDelete(notification)} disabled={deleting !== null} aria-label={notification.scheduleId ? `Delete schedule for ${notification.title}` : `Delete ${notification.title}`} title={notification.scheduleId ? "Delete schedule and its notifications" : "Delete notification"} className="shrink-0 rounded-lg p-2 text-muted transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50">
                      {deleting === deleteKey ? <span className="text-xs">Deleting...</span> : <Trash2 size={16} aria-hidden="true" />}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
