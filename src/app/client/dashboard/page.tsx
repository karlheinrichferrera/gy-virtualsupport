"use client";

import { useEffect, useState } from "react";
import { LayoutDashboard, Clock, ClipboardList, FileText, CalendarDays, DollarSign } from "lucide-react";
import Link from "next/link";
import * as actions from "@/lib/actions";

export default function ClientDashboardPage() {
  const [invoiceCount, setInvoiceCount] = useState(0);
  const [requestCount, setRequestCount] = useState(0);
  const [vaCount, setVaCount] = useState(0);

  useEffect(() => {
    (async () => {
      const [invoices, requests, vas] = await Promise.all([
        actions.getClientInvoices(),
        actions.getAllRequestsFlat(),
        actions.getProfiles(),
      ]);
      setInvoiceCount(invoices.length);
      setRequestCount(requests.filter((r) => r.request.status === "Pending").length);
      setVaCount(vas.length);
    })();
  }, []);

  const cards = [
    { label: "Timesheet", icon: Clock, href: "/client/dashboard/timesheet", color: "bg-blue-500", count: null, desc: "View VA timesheets" },
    { label: "Weekly Reports", icon: ClipboardList, href: "/client/dashboard/reports", color: "bg-purple-500", count: vaCount, desc: "VA weekly reports" },
    { label: "Invoices", icon: FileText, href: "/client/dashboard/invoices", color: "bg-emerald-500", count: invoiceCount, desc: "View & download invoices" },
    { label: "Leave & Requests", icon: CalendarDays, href: "/client/dashboard/requests", color: "bg-amber-500", count: requestCount, desc: "Pending requests" },
    { label: "Salary Adjustments", icon: DollarSign, href: "/client/dashboard/adjustments", color: "bg-rose-500", count: null, desc: "VA salary adjustments" },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
        <LayoutDashboard size={24} />
        Dashboard
      </h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <Link key={c.href} href={c.href} className="bg-card border border-border rounded-xl p-5 hover:shadow-md transition-shadow group">
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-10 h-10 ${c.color} rounded-lg flex items-center justify-center`}>
                  <Icon size={20} className="text-white" />
                </div>
                <h3 className="font-semibold text-foreground group-hover:text-emerald-600 transition-colors">{c.label}</h3>
              </div>
              <p className="text-sm text-muted">{c.desc}</p>
              {c.count !== null && <p className="text-2xl font-bold text-foreground mt-2">{c.count}</p>}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
