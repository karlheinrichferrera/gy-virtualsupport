"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard,
  Clock,
  ClipboardList,
  FileText,
  CalendarDays,
  DollarSign,
  Settings,
  LogOut,
} from "lucide-react";

const navItems = [
  { href: "/client/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/client/dashboard/timesheet", label: "Timesheet", icon: Clock },
  { href: "/client/dashboard/reports", label: "Weekly Reports", icon: ClipboardList },
  { href: "/client/dashboard/invoices", label: "Invoices", icon: FileText },
  { href: "/client/dashboard/requests", label: "Leave & Requests", icon: CalendarDays },
  { href: "/client/dashboard/adjustments", label: "Salary Adjustments", icon: DollarSign },
  { href: "/client/dashboard/settings", label: "Settings", icon: Settings },
];

export default function ClientSidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 h-full w-64 bg-gradient-to-b from-emerald-950 to-slate-900 text-slate-300 flex flex-col z-30">
      <div className="p-6 border-b border-white/10">
        <h1 className="text-xl font-bold text-white tracking-tight">
          GY Virtual Support
        </h1>
        <p className="text-xs text-emerald-300 mt-1">Client Portal</p>
      </div>

      <nav className="flex-1 py-4 px-3 space-y-1">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/client/dashboard" && pathname.startsWith(item.href));
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
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
  );
}
