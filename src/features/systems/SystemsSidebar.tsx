"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard } from "lucide-react";
import { useSystems } from "./systems.hooks";
import { CreateSystemDialog } from "./CreateSystemDialog";
import type { System } from "./systems.types";

const COLOR_MAP: Record<string, string> = {
  blue: "bg-blue-500",
  red: "bg-red-500",
  green: "bg-green-500",
  yellow: "bg-yellow-500",
  purple: "bg-purple-500",
  pink: "bg-pink-500",
  orange: "bg-orange-500",
  cyan: "bg-cyan-500",
  gray: "bg-gray-500",
};

export function SystemsSidebar() {
  const pathname = usePathname();
  const { data: systems, isLoading } = useSystems();

  return (
    <aside className="w-64 h-screen border-r flex flex-col shrink-0">
      {/* Logo */}
      <div className="p-4 border-b">
        <Link href="/systems" className="font-semibold text-lg tracking-tight">
          Kino
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
        <Link
          href="/dashboard"
          className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
            pathname === "/dashboard"
              ? "bg-accent text-accent-foreground font-medium"
              : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
          }`}
        >
          <LayoutDashboard className="size-4 shrink-0" />
          <span>Dashboard</span>
        </Link>

        <div className="my-2 border-t" />

        {/* Systems list */}
        {isLoading && (
          <div className="space-y-1 p-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-8 rounded-md bg-muted animate-pulse" />
            ))}
          </div>
        )}

        {systems?.map((system: System) => {
          const isActive = pathname === `/systems/${system.id}`;
          const dotColor = COLOR_MAP[system.color] ?? "bg-gray-400";

          return (
            <Link
              key={system.id}
              href={`/systems/${system.id}`}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
                isActive
                  ? "bg-accent text-accent-foreground font-medium"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
              }`}
            >
              <span className={`size-2 rounded-full shrink-0 ${dotColor}`} />
              <span className="truncate">{system.name}</span>
              {system.isInbox && (
                <span className="ml-auto text-xs text-muted-foreground/60">Inbox</span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t">
        <CreateSystemDialog />
      </div>
    </aside>
  );
}
