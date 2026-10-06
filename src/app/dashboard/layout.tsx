"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import { getVAProfile } from "@/lib/data";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [vaName, setVaName] = useState("");
  const [vaId, setVaId] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const id = localStorage.getItem("vaId");
    if (!id) {
      router.push("/");
      return;
    }
    const profile = getVAProfile(id);
    if (!profile) {
      router.push("/");
      return;
    }
    setVaId(id);
    setVaName(`${profile.firstName} ${profile.lastName}`);
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
      <Sidebar />
      <div className="ml-64">
        <Header vaName={vaName} vaId={vaId} />
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
