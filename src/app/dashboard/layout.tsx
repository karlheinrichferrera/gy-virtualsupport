"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import NotificationBell from "@/components/NotificationBell";
import VAAccountMenu from "@/components/VAAccountMenu";
import { getProfile, getCurrentVASession } from "@/lib/actions";
import { Menu } from "lucide-react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [vaName, setVaName] = useState("");
  const [vaId, setVaId] = useState("");
  const [profilePhoto, setProfilePhoto] = useState("");
  const [ready, setReady] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sessionError, setSessionError] = useState("");

  useEffect(() => {
    (async () => {
      try {
      const session = await getCurrentVASession();
      if (!session) { localStorage.removeItem("vaId"); router.replace("/"); return; }
      const id = session.id;
      localStorage.setItem("vaId", id);
      const profile = await getProfile(id);
      if (!profile) {
        router.push("/");
        return;
      }
      setVaId(id);
      setVaName(`${profile.firstName} ${profile.lastName}`);
      setProfilePhoto(profile.profilePicture || "");
      setReady(true);
      } catch { setSessionError("Unable to verify your session. Please refresh the page to try again."); }
    })();
  }, [router]);

  useEffect(() => {
    const handlePhoto = (event: Event) => {
      const detail = (event as CustomEvent<{ vaId: string; profilePicture: string }>).detail;
      if (detail?.vaId === vaId) setProfilePhoto(detail.profilePicture || "");
    };
    window.addEventListener("va-profile-photo-updated", handlePhoto);
    return () => window.removeEventListener("va-profile-photo-updated", handlePhoto);
  }, [vaId]);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        {sessionError ? <p role="alert" className="px-4 text-center text-red-600">{sessionError} <button className="underline" onClick={() => window.location.reload()}>Refresh</button></p> : <div className="animate-pulse text-muted">Loading...</div>}
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
            <VAAccountMenu name={vaName} photo={profilePhoto} />
          </div>
        </header>
        <main className="min-w-0 p-3 sm:p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
