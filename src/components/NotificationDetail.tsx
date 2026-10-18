"use client";

import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { ExternalLink, X } from "lucide-react";
import type { Notification } from "@/lib/notification-types";

export default function NotificationDetail({ notification, onClose, onOpenPage }: {
  notification: Notification; onClose: () => void; onOpenPage?: () => void;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); onClose(); }
      if (event.key !== "Tab") return;
      const controls = panel.current?.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],[tabindex="0"]');
      if (!controls?.length) return;
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", keyboard);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener("keydown", keyboard); };
  }, [onClose]);
  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-3 sm:p-6" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <div ref={panel} role="dialog" aria-modal="true" aria-labelledby={titleId} className="flex max-h-[calc(100dvh-1.5rem)] w-full min-w-0 max-w-xl flex-col overflow-hidden rounded-2xl bg-white text-gray-900 shadow-2xl">
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-gray-200 px-5 py-4">
          <h2 id={titleId} className="min-w-0 break-words text-lg font-semibold">{notification.title}</h2>
          <button type="button" onClick={onClose} aria-label="Close notification details" className="shrink-0 rounded-lg p-1.5 hover:bg-gray-100"><X size={20} /></button>
        </div>
        <div className="min-h-0 space-y-5 overflow-y-auto overscroll-contain p-5">
          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-gray-700">{notification.message}</p>
          {notification.imageUrl && <Image src={notification.imageUrl} alt={`Image for ${notification.title}`} width={800} height={600} unoptimized className="h-auto max-h-[60dvh] w-full rounded-lg object-contain" />}
          {onOpenPage && <button type="button" onClick={onOpenPage} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700">Open page <ExternalLink size={15} /></button>}
        </div>
      </div>
    </div>, document.body,
  );
}
