"use client";

import { useEffect, useState } from "react";
import * as actions from "@/lib/actions";
import type { VAProfile } from "@/lib/data";
import { Users, FileText, CalendarDays, DollarSign, Clock } from "lucide-react";
import Link from "next/link";

export default function AdminDashboardPage() {
  const [vaProfiles, setVaProfiles] = useState<VAProfile[]>([]);
  const [allInvoices, setAllInvoices] = useState<{ vaId: string; vaName: string; invoice: { status: string; amountDisbursed: string } }[]>([]);
  const [allRequests, setAllRequests] = useState<{ vaId: string; vaName: string; request: { id: string; type: string; reason: string; status: string } }[]>([]);

  useEffect(() => {
    (async () => {
      setVaProfiles(await actions.getProfiles());
      setAllInvoices(await actions.getAllInvoicesFlat());
      setAllRequests(await actions.getAllRequestsFlat());
    })();
  }, []);

  const pendingInvoices = allInvoices.filter((i) => i.invoice.status === "Pending");
  const pendingRequests = allRequests.filter((r) => r.request.status === "Pending");

  const totalPaid = allInvoices
    .filter((i) => i.invoice.status === "Paid")
    .reduce((sum, i) => sum + parseFloat(i.invoice.amountDisbursed.replace("$", "") || "0"), 0);

  const stats = [
    { label: "Active VAs", value: vaProfiles.length, icon: Users, color: "bg-blue-100 text-blue-700", href: "/admin/dashboard/vas" },
    { label: "Total Invoices", value: allInvoices.length, icon: FileText, color: "bg-emerald-100 text-emerald-700", href: "/admin/dashboard/invoices" },
    { label: "Pending Invoices", value: pendingInvoices.length, icon: Clock, color: "bg-amber-100 text-amber-700", href: "/admin/dashboard/invoices" },
    { label: "Pending Requests", value: pendingRequests.length, icon: CalendarDays, color: "bg-rose-100 text-rose-700", href: "/admin/dashboard/requests" },
    { label: "Total Disbursed", value: `$${totalPaid.toFixed(2)}`, icon: DollarSign, color: "bg-teal-100 text-teal-700", href: "/admin/dashboard/invoices" },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Overview</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Link
              key={stat.label}
              href={stat.href}
              className="bg-card rounded-xl border border-border p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted">{stat.label}</p>
                  <p className="text-2xl font-bold text-foreground mt-1">{stat.value}</p>
                </div>
                <div className={`w-12 h-12 rounded-xl ${stat.color} flex items-center justify-center`}>
                  <Icon size={22} />
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card rounded-xl border border-border p-5">
          <h2 className="text-lg font-semibold text-foreground mb-4">Recent Pending Requests</h2>
          {pendingRequests.length === 0 ? (
            <p className="text-sm text-muted">No pending requests</p>
          ) : (
            <div className="space-y-3">
              {pendingRequests.slice(0, 5).map((r) => (
                <div key={r.request.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div>
                    <p className="text-sm font-medium text-foreground">{r.vaName}</p>
                    <p className="text-xs text-muted">{r.request.type} - {r.request.reason.substring(0, 50)}</p>
                  </div>
                  <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                    Pending
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-card rounded-xl border border-border p-5">
          <h2 className="text-lg font-semibold text-foreground mb-4">VA Directory</h2>
          <div className="space-y-3">
            {vaProfiles.map((va) => (
              <div key={va.id} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-sm font-bold">
                  {va.firstName.charAt(0)}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">
                    {va.firstName} {va.lastName}
                  </p>
                  <p className="text-xs text-muted">{va.position} - ID: {va.id}</p>
                </div>
                <span className="text-xs text-muted">{va.currentRate}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
