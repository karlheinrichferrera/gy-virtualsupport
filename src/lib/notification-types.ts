export type NotificationAudience = "va" | "client";
export type NotificationRecurrence = "none" | "daily" | "weekly" | "monthly" | "yearly";

export type Notification = {
  id: number;
  vaId: string;
  clientId: number | null;
  audience: NotificationAudience;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
  createdBy: string;
  imageUrl: string;
  redirectTo: string;
  expiresAt: string | null;
  scheduledFor: string | null;
  recurrence: NotificationRecurrence;
  scheduleId: number | null;
  status?: "scheduled" | "active";
};

export type NotificationInput = {
  audience: NotificationAudience;
  vaId?: string;
  clientId?: number | null;
  title: string;
  message: string;
  type?: string;
  createdBy?: string;
  imageUrl?: string;
  redirectTo?: string;
  startsAt?: string | null;
  expiresAt?: string | null;
  recurrence?: NotificationRecurrence;
  timeZone?: string;
};
