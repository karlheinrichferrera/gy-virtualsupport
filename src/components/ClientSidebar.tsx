"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard,
  ClipboardList,
  FileText,
  Fingerprint,
  CalendarDays,
  DollarSign,
  Settings,
  LogOut,
  Users,
  X,
} from "lucide-react";

const navItems = [
  { href: "/client/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/client/dashboard/vas", label: "My VAs", icon: Users },
  { href: "/client/dashboard/timeproof", label: "Timeproof", icon: Fingerprint },
  { href: "/client/dashboard/reports", label: "Weekly Reports", icon: ClipboardList },
  { href: "/client/dashboard/invoices", label: "Invoices", icon: FileText },
  { href: "/client/dashboard/requests", label: "Leave & Requests", icon: CalendarDays },
  { href: "/client/dashboard/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/client/dashboard/adjustments", label: "Salary Adjustments", icon: DollarSign },
  { href: "/client/dashboard/settings", label: "Settings", icon: Settings },
];

export default function ClientSidebar({ open, onClose }: { open?: boolean; onClose?: () => void }) {
  const pathname = usePathname();

  return (
    <>
      {open && <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={onClose} />}
      <aside className={`fixed left-0 top-0 h-full w-64 bg-gradient-to-b from-emerald-950 to-slate-900 text-slate-300 flex flex-col z-40 transition-transform duration-200 ${open ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0`}>
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="GY Virtual Support" className="w-10 h-10" />
            <div>
              <h1 className="text-base font-bold text-white tracking-tight leading-tight">
                GY Virtual Support
              </h1>
              <p className="text-xs text-emerald-300">Client Portal</p>
            </div>
          </div>
          <button onClick={onClose} className="lg:hidden p-1 hover:bg-white/10 rounded-lg">
            <X size={20} className="text-slate-300" />
          </button>
        </div>

        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/client/dashboard" && pathname.startsWith(item.href));
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-emerald-600 text-white"
                    : "text-slate-300 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Icon size={18} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-white/10">
          <Link
            href="/client"
            onClick={() => {
              localStorage.removeItem("clientAuth");
              localStorage.removeItem("clientEmail");
              localStorage.removeItem("clientDisplayName");
            }}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-300 hover:bg-white/5 hover:text-white transition-colors"
          >
            <LogOut size={18} />
            Sign Out
          </Link>
        </div>
      </aside>
    </>
  );
}
