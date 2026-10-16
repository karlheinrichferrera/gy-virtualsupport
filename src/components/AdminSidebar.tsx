"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  Users,
  DollarSign,
  FileText,
  CalendarDays,
  LayoutDashboard,
  LogOut,
  Settings,
  ClipboardList,
  Building2,
  Fingerprint,
  X,
} from "lucide-react";

const navItems = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/dashboard/vas", label: "VA Management", icon: Users },
  { href: "/admin/dashboard/adjustments", label: "Salary Adjustments", icon: DollarSign },
  { href: "/admin/dashboard/invoices", label: "Invoices", icon: FileText },
  { href: "/admin/dashboard/requests", label: "Leave & Requests", icon: CalendarDays },
  { href: "/admin/dashboard/timeproof", label: "Timeproof", icon: Fingerprint },
  { href: "/admin/dashboard/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/admin/dashboard/reports", label: "Weekly Reports", icon: ClipboardList },
  { href: "/admin/dashboard/clients", label: "Client Management", icon: Building2 },
  { href: "/admin/dashboard/settings", label: "Settings", icon: Settings },
];

export default function AdminSidebar({ open, onClose }: { open?: boolean; onClose?: () => void }) {
  const pathname = usePathname();

  return (
    <>
      {open && <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={onClose} />}
      <aside className={`fixed left-0 top-0 h-full w-64 bg-gradient-to-b from-indigo-950 to-slate-900 text-slate-300 flex flex-col z-40 transition-transform duration-200 ${open ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0`}>
        <div className="p-6 border-b border-white/10 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">
              GY Virtual Support
            </h1>
            <p className="text-xs text-indigo-300 mt-1">Admin Portal</p>
          </div>
          <button onClick={onClose} className="lg:hidden p-1 hover:bg-white/10 rounded-lg">
            <X size={20} className="text-slate-300" />
          </button>
        </div>

        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/admin/dashboard" && pathname.startsWith(item.href));
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-indigo-600 text-white"
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
            href="/admin"
            onClick={() => { localStorage.removeItem("adminAuth"); localStorage.removeItem("adminUsername"); localStorage.removeItem("adminDisplayName"); }}
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
