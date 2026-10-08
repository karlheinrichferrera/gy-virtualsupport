"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  User,
  DollarSign,
  FileText,
  CalendarDays,
  LayoutDashboard,
  LogOut,
  Clock,
} from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/profile", label: "My Information", icon: User },
  { href: "/dashboard/adjustments", label: "Salary Adjustments", icon: DollarSign },
  { href: "/dashboard/invoices", label: "Invoices", icon: FileText },
  { href: "/dashboard/requests", label: "Leave & Shift Requests", icon: CalendarDays },
  { href: "/dashboard/timesheet", label: "Timesheet", icon: Clock },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 h-full w-64 bg-sidebar text-sidebar-text flex flex-col z-30">
      <div className="p-6 border-b border-white/10">
        <h1 className="text-xl font-bold text-white tracking-tight">
          GY Virtual Support
        </h1>
        <p className="text-xs text-sidebar-text mt-1">VA Portal</p>
      </div>

      <nav className="flex-1 py-4 px-3 space-y-1">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? "bg-sidebar-active text-white"
                  : "text-sidebar-text hover:bg-white/5 hover:text-white"
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
          href="/"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-text hover:bg-white/5 hover:text-white transition-colors"
        >
          <LogOut size={18} />
          Sign Out
        </Link>
      </div>
    </aside>
  );
}
