"use client";

import { useEffect, useId, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Settings, User } from "lucide-react";

export default function VAAccountMenu({ name, photo }: { name: string; photo: string }) {
  const pathname = usePathname();
  const menuId = useId();
  const [openPath, setOpenPath] = useState<string | null>(null);
  const [failedPhoto, setFailedPhoto] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const initialFocus = useRef<"first" | "last">("first");
  const open = openPath === pathname;

  useEffect(() => {
    if (!open) return;
    const items = menuRef.current?.querySelectorAll<HTMLAnchorElement>("a");
    items?.[initialFocus.current === "last" ? items.length - 1 : 0]?.focus();
    const dismiss = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpenPath(null);
    };
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpenPath(null);
        buttonRef.current?.focus();
      } else if (event.key === "Tab") {
        setOpenPath(null);
      } else if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
        const links = Array.from(menuRef.current?.querySelectorAll<HTMLAnchorElement>("a") || []);
        if (!links.length) return;
        event.preventDefault();
        const current = links.findIndex(link => link === document.activeElement);
        const next = event.key === "Home" ? 0 : event.key === "End" ? links.length - 1
          : (current + (event.key === "ArrowDown" ? 1 : -1) + links.length) % links.length;
        links[next].focus();
      }
    };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", keyboard);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", keyboard);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        ref={buttonRef}
        type="button"
        aria-label="Account menu"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => { initialFocus.current = "first"; setOpenPath(open ? null : pathname); }}
        onKeyDown={event => {
          if (!open && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
            event.preventDefault();
            initialFocus.current = event.key === "ArrowUp" ? "last" : "first";
            setOpenPath(pathname);
          }
        }}
        className="flex min-h-11 items-center gap-1.5 rounded-lg p-1 transition-colors hover:bg-background focus-visible:outline-2 focus-visible:outline-primary"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary text-sm font-bold text-white">
          {photo && failedPhoto !== photo ? (
            <Image src={photo} alt={`${name}'s profile photo`} width={36} height={36} unoptimized onError={() => setFailedPhoto(photo)} className="h-full w-full object-cover" />
          ) : <span aria-hidden="true">{name.trim().charAt(0).toUpperCase() || "V"}</span>}
        </span>
        <ChevronDown size={14} aria-hidden="true" className="text-muted" />
      </button>
      {open && (
        <div ref={menuRef} id={menuId} role="menu" aria-label="VA account" className="absolute right-0 top-full z-40 mt-2 w-56 max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-xl border border-border bg-card py-1.5 shadow-xl">
          <p className="truncate border-b border-border px-4 py-2 text-sm font-semibold text-foreground">{name}</p>
          <Link role="menuitem" tabIndex={-1} href="/dashboard/profile" onClick={() => setOpenPath(null)} className="flex items-center gap-3 px-4 py-3 text-sm text-foreground hover:bg-background focus:bg-background focus:outline-none">
            <User size={16} aria-hidden="true" className="shrink-0 text-muted" />
            My Information
          </Link>
          <Link role="menuitem" tabIndex={-1} href="/dashboard/settings" onClick={() => setOpenPath(null)} className="flex items-center gap-3 px-4 py-3 text-sm text-foreground hover:bg-background focus:bg-background focus:outline-none">
            <Settings size={16} aria-hidden="true" className="shrink-0 text-muted" />
            Settings
          </Link>
        </div>
      )}
    </div>
  );
}
