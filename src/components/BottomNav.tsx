"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Box, LayoutDashboard, List, Plus, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuickAddStore } from "@/features/tasks/quick-add.store";

const NAV_ITEMS = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/systems", icon: Box, label: "Sistemas" },
  { href: "/tasks", icon: List, label: "Tareas" },
  { href: "/settings", icon: Settings, label: "Ajustes" },
];

export function BottomNav() {
  const pathname = usePathname();
  const setOpen = useQuickAddStore((s) => s.setOpen);

  function isActive(href: string) {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  }

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 md:hidden z-(--z-overlay) bg-background/95 backdrop-blur-sm border-t border-border"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex items-center justify-around h-14 max-w-lg mx-auto px-1">
        {/* First 2 nav items */}
        {NAV_ITEMS.slice(0, 2).map(({ href, icon: Icon, label }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex flex-col items-center gap-0.5 flex-1 py-1 rounded-md transition-colors",
              isActive(href)
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className={cn("size-5", isActive(href) && "stroke-[2.5px]")} />
            <span className="text-[10px] leading-tight">{label}</span>
          </Link>
        ))}

        {/* FAB: create task */}
        <button
          onClick={() => setOpen(true)}
          className="relative -top-3 flex items-center justify-center size-12 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 active:scale-95 transition-transform shrink-0"
          aria-label="Nueva tarea"
        >
          <Plus className="size-5" />
        </button>

        {/* Last 2 nav items */}
        {NAV_ITEMS.slice(2).map(({ href, icon: Icon, label }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex flex-col items-center gap-0.5 flex-1 py-1 rounded-md transition-colors",
              isActive(href)
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className={cn("size-5", isActive(href) && "stroke-[2.5px]")} />
            <span className="text-[10px] leading-tight">{label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
