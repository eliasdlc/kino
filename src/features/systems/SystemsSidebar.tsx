"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo } from "react";
import {
  Box,
  CircleCheckBig,
  Inbox,
  LayoutDashboard,
  LogOut,
  Settings,
} from "lucide-react";
import { useSystems } from "./systems.hooks";
import { CreateSystemDialog } from "./CreateSystemDialog";
import type { System } from "./systems.types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { authClient } from "@/auth-client";
import { useRouter } from "next/navigation";
import { useSystemsTreeStore } from "./systems.store";
import { SystemTreeItem } from "./SystemTreeItem";

interface SystemsSidebarProps {
  userName?: string;
  userEmail?: string;
  userImage?: string | null;
}

export function SystemsSidebar({
  userName,
  userEmail,
  userImage,
}: SystemsSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: systems, isLoading } = useSystems();
  const setExpanded = useSystemsTreeStore((s) => s.setExpanded);

  const initials = userName
    ? userName
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
    : "?";

  // Extract active system and folder from pathname
  const activeSystemId = useMemo(() => {
    const match = pathname.match(/^\/systems\/([^/]+)/);
    return match?.[1] ?? null;
  }, [pathname]);

  const activeFolderId = useMemo(() => {
    const match = pathname.match(/^\/systems\/[^/]+\/folders\/([^/]+)/);
    return match?.[1] ?? null;
  }, [pathname]);

  // Auto-expand active system on navigation
  useEffect(() => {
    if (activeSystemId) setExpanded(activeSystemId, true);
  }, [activeSystemId, setExpanded]);

  async function handleSignOut() {
    await authClient.signOut();
    router.push("/login");
  }

  const inboxSystem = systems?.find((s: System) => s.isInbox);
  const regularSystems = systems?.filter((s: System) => !s.isInbox) ?? [];

  return (
    <aside className="w-64 h-screen border-r border-sidebar-border bg-sidebar flex flex-col shrink-0">
      {/* Logo + User */}
      <div className="p-4 border-b border-sidebar-border space-y-3">
        <Link
          href="/dashboard"
          className="font-bold text-lg tracking-tight text-sidebar-foreground"
        >
          Kino
        </Link>

        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2.5 w-full rounded-md px-2 py-1.5 hover:bg-sidebar-accent transition-colors outline-none">
            <Avatar className="size-7">
              {userImage && (
                <AvatarImage src={userImage} alt={userName ?? "User"} />
              )}
              <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col items-start min-w-0">
              <span className="text-sm font-medium truncate text-sidebar-foreground">
                {userName ?? "Usuario"}
              </span>
              {userEmail && (
                <span className="text-[11px] text-muted-foreground truncate max-w-[160px]">
                  {userEmail}
                </span>
              )}
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium">{userName}</p>
                <p className="text-xs text-muted-foreground">{userEmail}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/settings" className="flex items-center gap-2">
                <Settings className="size-4" />
                Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleSignOut}
              className="text-destructive focus:text-destructive"
            >
              <LogOut className="size-4 mr-2" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
        <Link
          href="/dashboard"
          className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${pathname === "/dashboard"
            ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium border-l-2 border-sidebar-primary"
            : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
            }`}
        >
          <LayoutDashboard className="size-4 shrink-0" />
          <span>Dashboard</span>
        </Link>

        <Link
          href="/systems"
          className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${pathname === "/systems"
            ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium border-l-2 border-sidebar-primary"
            : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
            }`}
        >
          <Box className="size-4 shrink-0" />
          <span>Systems</span>
        </Link>

        <Link
          href="/tasks"
          className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${pathname === "/systems"
            ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium border-l-2 border-sidebar-primary"
            : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
            }`}
        >
          <CircleCheckBig className="size-4 shrink-0" />
          <span>Tasks</span>
        </Link>

        <Link
          href="/settings"
          className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${pathname === "/settings"
            ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium border-l-2 border-sidebar-primary"
            : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
            }`}
        >
          <Settings className="size-4 shrink-0" />
          <span>Settings</span>
        </Link>

        <div className="my-3 border-t border-sidebar-border" />

        <p className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
          Systems
        </p>

        {/* Inbox — always pinned at the top, visually distinct */}
        {inboxSystem && (
          <Link
            href={`/systems/${inboxSystem.id}`}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors border ${pathname === `/systems/${inboxSystem.id}`
              ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium border-l-2 border-sidebar-primary border-t-sidebar-border/50 border-r-sidebar-border/50 border-b-sidebar-border/50"
              : "bg-sidebar-accent/20 border-sidebar-border/40 text-sidebar-foreground hover:bg-sidebar-accent/40"
              }`}
          >
            <Inbox className="size-4 shrink-0 text-blue-500" />
            <span className="truncate font-medium">{inboxSystem.name}</span>
          </Link>
        )}

        {/* Regular systems as collapsible tree items */}
        {isLoading && (
          <div className="space-y-1 p-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-8 rounded-md bg-muted animate-pulse" />
            ))}
          </div>
        )}

        {regularSystems.map((system: System) => (
          <SystemTreeItem
            key={system.id}
            system={system}
            isActive={activeSystemId === system.id}
            activeFolderId={activeFolderId ?? undefined}
          />
        ))}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-sidebar-border">
        <CreateSystemDialog />
      </div>
    </aside>
  );
}
