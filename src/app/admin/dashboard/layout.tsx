"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import AdminSidebar from "@/components/AdminSidebar";
import { getCurrentAdminSession, logoutAdmin } from "@/lib/actions";
import { ChevronDown, LogOut, Settings, Menu } from "lucide-react";

export default function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [displayName, setDisplayName] = useState("Administrator");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sessionError, setSessionError] = useState("");
  const [sessionAttempt, setSessionAttempt] = useState(0);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    let active = true;
    async function verifySession() {
      setSessionError("");
      try {
        const admin = await getCurrentAdminSession();
        if (!active) return;
        if (!admin) {
          localStorage.removeItem("adminAuth");
          localStorage.removeItem("adminUsername");
          localStorage.removeItem("adminDisplayName");
          router.replace("/admin");
          return;
        }
        localStorage.setItem("adminAuth", "true");
        localStorage.setItem("adminUsername", admin.username);
        localStorage.setItem("adminDisplayName", admin.displayName);
        setDisplayName(admin.displayName || "Administrator");
        setReady(true);
      } catch {
        if (active) setSessionError("Unable to verify your admin session. Please try again.");
      }
    }
    void verifySession();
    return () => { active = false; };
  }, [pathname, router, sessionAttempt]);

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    setSessionError("");
    try {
      await logoutAdmin();
      localStorage.removeItem("adminAuth");
      localStorage.removeItem("adminUsername");
      localStorage.removeItem("adminDisplayName");
      router.replace("/admin");
      router.refresh();
    } catch {
      setSessionError("Unable to sign out. Please try again.");
      setSigningOut(false);
    }
  }

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        {sessionError ? (
          <div className="px-4 text-center space-y-3">
            <p role="alert" className="text-sm text-red-600">{sessionError}</p>
            <button type="button" onClick={() => setSessionAttempt(value => value + 1)} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white">Try again</button>
          </div>
        ) : <div className="animate-pulse text-muted">Loading...</div>}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AdminSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} onSignOut={handleSignOut} signingOut={signingOut} />
      <div className="min-w-0 lg:ml-64">
        <header className="h-16 bg-card border-b border-border flex items-center justify-between gap-2 px-3 sm:px-4 lg:px-6 sticky top-0 z-20">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <button onClick={() => setSidebarOpen(true)} aria-label="Open navigation" className="lg:hidden shrink-0 p-2 hover:bg-background rounded-lg">
              <Menu size={20} className="text-muted" />
            </button>
            <div className="min-w-0">
              <h2 className="truncate text-sm sm:text-lg font-semibold text-foreground">Admin Dashboard</h2>
              <p className="text-xs text-muted">Admin Portal</p>
            </div>
          </div>
          <div className="relative shrink-0">
            <button
              onClick={() => setShowMenu((v) => !v)}
              className="flex items-center gap-2 lg:gap-3 hover:opacity-80 transition-opacity"
            >
              <span className="hidden sm:inline max-w-40 truncate text-xs bg-indigo-100 text-indigo-700 px-2.5 py-1 rounded-full font-medium">
                {displayName}
              </span>
              <div className="w-9 h-9 rounded-full bg-indigo-600 flex items-center justify-center text-white text-sm font-bold">
                {displayName.charAt(0).toUpperCase()}
              </div>
              <ChevronDown size={16} className="text-slate-400" />
            </button>
            {showMenu && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setShowMenu(false)} />
                <div className="absolute right-0 top-full mt-2 w-52 bg-white border border-slate-200 rounded-xl shadow-lg z-40 py-1.5">
                  <Link
                    href="/admin/dashboard/settings"
                    onClick={() => setShowMenu(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    <Settings size={16} className="text-slate-400" />
                    Account Settings
                  </Link>
                  <div className="border-t border-slate-100 my-1" />
                  <button
                    onClick={handleSignOut}
                    disabled={signingOut}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                  >
                    <LogOut size={16} />
                    {signingOut ? "Signing out…" : "Sign Out"}
                  </button>
                </div>
              </>
            )}
          </div>
        </header>
        <main className="min-w-0 p-3 sm:p-4 lg:p-6">
          {sessionError && <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">{sessionError}</p>}
          {children}
        </main>
      </div>
    </div>
  );
}
