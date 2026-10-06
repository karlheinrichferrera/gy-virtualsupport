"use client";

import { Bell } from "lucide-react";

interface HeaderProps {
  vaName: string;
  vaId: string;
}

export default function Header({ vaName, vaId }: HeaderProps) {
  return (
    <header className="h-16 bg-card border-b border-border flex items-center justify-between px-6 sticky top-0 z-20">
      <div>
        <h2 className="text-lg font-semibold text-foreground">
          Welcome back, {vaName}
        </h2>
        <p className="text-xs text-muted">ID: {vaId}</p>
      </div>
      <div className="flex items-center gap-4">
        <button className="relative p-2 rounded-lg hover:bg-background transition-colors">
          <Bell size={20} className="text-muted" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-danger rounded-full" />
        </button>
        <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-white text-sm font-bold">
          {vaName.charAt(0)}
        </div>
      </div>
    </header>
  );
}
