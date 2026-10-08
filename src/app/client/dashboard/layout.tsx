"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ClientSidebar from "@/components/ClientSidebar";
import { ChevronDown, LogOut } from "lucide-react";

export default function ClientDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [displayName, setDisplayName] = useState("Client");

  useEffect(() => {
    const auth = localStorage.getItem("clientAuth");
    if (auth !== "true") {
      router.push("/client");
      return;
    }
    const name = localStorage.getItem("clientDisplayName");
    if (name) setDisplayName(name);
    setReady(true);
  }, [router]);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <ClientSidebar />
      <div className="ml-64">
        <header className="h-16 bg-card border-b border-border flex items-center justify-between px-6 sticky top-0 z-20">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Client Dashboard</h2>
            <p className="text-xs text-muted">Client Portal</p>
          </div>
          <div className="relative">
            <button
              onClick={() => setShowMenu((v) => !v)}
              className="flex items-center gap-3 hover:opacity-80 transition-opacity"
            >
              <span className="text-xs bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full font-medium">
                {displayName}
              </span>
              <div className="w-9 h-9 rounded-full bg-emerald-600 flex items-center justify-center text-white text-sm font-bold">
                {displayName.charAt(0).toUpperCase()}
              </div>
              <ChevronDown size={16} className="text-slate-400" />
            </button>
            {showMenu && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setShowMenu(false)} />
                <div className="absolute right-0 top-full mt-2 w-52 bg-white border border-slate-200 rounded-xl shadow-lg z-40 py-1.5">
                  <button
                    onClick={() => {
                      localStorage.removeItem("clientAuth");
                      localStorage.removeItem("clientEmail");
                      localStorage.removeItem("clientDisplayName");
                      router.push("/client");
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <LogOut size={16} />
                    Sign Out
                  </button>
                </div>
              </>
            )}
          </div>
        </header>
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
