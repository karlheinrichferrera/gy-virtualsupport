"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  User,
  DollarSign,
  FileText,
  CalendarDays,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import {
  getVAProfile,
  getInvoices,
  getLeaveRequests,
  getAdjustments,
  type VAProfile,
} from "@/lib/data";

export default function DashboardHome() {
  const [profile, setProfile] = useState<VAProfile | null>(null);
  const [stats, setStats] = useState({
    totalInvoices: 0,
    paidInvoices: 0,
    pendingInvoices: 0,
    pendingRequests: 0,
    totalEarned: "",
    currentRate: "",
    lastAdjustment: "",
  });

  useEffect(() => {
    const id = localStorage.getItem("vaId") || "";
    const p = getVAProfile(id);
    if (!p) return;
    setProfile(p);

    const inv = getInvoices(id);
    const requests = getLeaveRequests(id);
    const adjustments = getAdjustments(id);
    const paid = inv.filter((i) => i.status === "Paid");
    const pending = inv.filter((i) => i.status === "Pending");
    const totalEarned = paid.reduce((sum, i) => {
      const amt = parseFloat(i.amountDisbursed.replace("$", "").replace(",", "")) || 0;
      return sum + amt;
    }, 0);
    const pendingReqs = requests.filter((r) => r.status === "Pending").length;
    const lastAdj = adjustments.length > 0 ? adjustments[adjustments.length - 1] : null;

    setStats({
      totalInvoices: inv.filter((i) => i.status).length,
      paidInvoices: paid.length,
      pendingInvoices: pending.length,
      pendingRequests: pendingReqs,
      totalEarned: `$${totalEarned.toFixed(2)}`,
      currentRate: p.currentRate,
      lastAdjustment: lastAdj?.effectivityDate || "N/A",
    });
  }, []);

  if (!profile) return null;

  const cards = [
    {
      title: "My Information",
      desc: "View and manage your personal details",
      icon: User,
      href: "/dashboard/profile",
      color: "bg-blue-500",
    },
    {
      title: "Salary Adjustments",
      desc: "Check promotion and salary history",
      icon: DollarSign,
      href: "/dashboard/adjustments",
      color: "bg-emerald-500",
    },
    {
      title: "Invoices",
      desc: "Create, send, and track invoices",
      icon: FileText,
      href: "/dashboard/invoices",
      color: "bg-violet-500",
    },
    {
      title: "Leave & Shift Requests",
      desc: "Submit and track your requests",
      icon: CalendarDays,
      href: "/dashboard/requests",
      color: "bg-amber-500",
    },
  ];

  const statItems = [
    {
      label: "Total Earned",
      value: stats.totalEarned,
      icon: TrendingUp,
      color: "text-emerald-600",
    },
    {
      label: "Current Rate",
      value: stats.currentRate,
      icon: DollarSign,
      color: "text-blue-600",
    },
    {
      label: "Invoices Paid",
      value: `${stats.paidInvoices}/${stats.totalInvoices}`,
      icon: CheckCircle,
      color: "text-emerald-600",
    },
    {
      label: "Pending Requests",
      value: String(stats.pendingRequests),
      icon: stats.pendingRequests > 0 ? AlertCircle : Clock,
      color: stats.pendingRequests > 0 ? "text-amber-600" : "text-slate-500",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statItems.map((s) => {
          const Icon = s.icon;
          return (
            <div
              key={s.label}
              className="bg-card rounded-xl border border-border p-5"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted">{s.label}</span>
                <Icon size={18} className={s.color} />
              </div>
              <p className="text-2xl font-bold text-foreground">{s.value}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.href}
              href={card.href}
              className="bg-card rounded-xl border border-border p-6 hover:shadow-lg hover:border-primary/30 transition-all group"
            >
              <div className="flex items-start gap-4">
                <div
                  className={`w-12 h-12 ${card.color} rounded-xl flex items-center justify-center shrink-0`}
                >
                  <Icon className="text-white" size={22} />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                    {card.title}
                  </h3>
                  <p className="text-sm text-muted mt-1">{card.desc}</p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      <div className="bg-card rounded-xl border border-border p-6">
        <h3 className="font-semibold text-foreground mb-3">Quick Info</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-muted">Position</span>
            <p className="font-medium text-foreground">{profile.position}</p>
          </div>
          <div>
            <span className="text-muted">Date Hired</span>
            <p className="font-medium text-foreground">{profile.dateHired}</p>
          </div>
          <div>
            <span className="text-muted">Last Salary Adjustment</span>
            <p className="font-medium text-foreground">
              {stats.lastAdjustment}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
