"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import NotificationBell from "@/components/NotificationBell";
import { getProfile, autoFillScheduleTimeproof } from "@/lib/actions";
import { Menu } from "lucide-react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [vaName, setVaName] = useState("");
  const [vaId, setVaId] = useState("");
  const [ready, setReady] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const id = localStorage.getItem("vaId");
    if (!id) {
      router.push("/");
      return;
    }
    (async () => {
      const profile = await getProfile(id);
      if (!profile) {
        router.push("/");
        return;
      }
      setVaId(id);
      setVaName(`${profile.firstName} ${profile.lastName}`);
      setReady(true);
      autoFillScheduleTimeproof(id);
    })();
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
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="min-w-0 lg:ml-64">
        <header className="h-16 bg-card border-b border-border flex items-center justify-between gap-2 px-3 sm:px-4 lg:px-6 sticky top-0 z-20">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <button onClick={() => setSidebarOpen(true)} aria-label="Open navigation" className="lg:hidden shrink-0 p-2 hover:bg-background rounded-lg">
              <Menu size={20} className="text-muted" />
            </button>
            <div className="min-w-0">
              <h2 className="truncate text-sm sm:text-lg font-semibold text-foreground">
                Welcome back, {vaName}
              </h2>
              <p className="text-xs text-muted">ID: {vaId}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1 sm:gap-4">
            <NotificationBell vaId={vaId} />
            <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-white text-sm font-bold">
              {vaName.charAt(0)}
            </div>
          </div>
        </header>
        <main className="min-w-0 p-3 sm:p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
