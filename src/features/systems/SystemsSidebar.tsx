"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo } from "react";
import {
  Box,
  Inbox,
  LayoutDashboard,
  List,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
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
import { getSystemColor } from "@/shared/utils/system-colors";
import { cn } from "@/lib/utils";
import { useSidebar } from "@/components/ui/sidebar";

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
  const setOnlyExpanded = useSystemsTreeStore((s) => s.setOnlyExpanded);
  const collapsed = useSystemsTreeStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useSystemsTreeStore((s) => s.toggleSidebar);
  const { isMobile, openMobile, setOpenMobile } = useSidebar();

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

  // Auto-expand active system on navigation and close others
  useEffect(() => {
    if (activeSystemId) setOnlyExpanded(activeSystemId);
  }, [activeSystemId, setOnlyExpanded]);

  async function handleSignOut() {
    await authClient.signOut();
    router.push("/login");
  }

  const inboxSystem = systems?.find((s: System) => s.isInbox);
  const regularSystems = systems?.filter((s: System) => !s.isInbox) ?? [];

  // On mobile, collapsed is always false (the sheet shows the full sidebar)
  const effectiveCollapsed = isMobile ? false : collapsed;

  function navLinkClass(active: boolean) {
    return cn(
      "flex items-center px-3 py-2.5 rounded-md text-sm motion-safe:transition-colors",
      effectiveCollapsed ? "justify-center" : "gap-2.5",
      active
        ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
        : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
    );
  }

  const sidebarContent = (
    <>
      {/* Logo + User */}
      <div className="p-4 border-b border-sidebar-border space-y-3">
        <div className="flex items-center">
          {!effectiveCollapsed && (
            <Link
              href="/dashboard"
              className="font-bold text-lg tracking-tight text-sidebar-foreground"
              onClick={() => isMobile && setOpenMobile(false)}
            >
              Kino
            </Link>
          )}
          {!isMobile && (
            <button
              onClick={toggleSidebar}
              className={cn(
                "p-1 rounded-md hover:bg-sidebar-accent text-muted-foreground motion-safe:transition-colors",
                effectiveCollapsed ? "mx-auto" : "ml-auto"
              )}
            >
              {effectiveCollapsed ? (
                <PanelLeftOpen className="size-5" />
              ) : (
                <PanelLeftClose className="size-5" />
              )}
            </button>
          )}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger
            className={cn(
              "flex items-center w-full rounded-md px-2 py-1.5 hover:bg-sidebar-accent motion-safe:transition-colors outline-none",
              effectiveCollapsed ? "justify-center" : "gap-2.5"
            )}
          >
            <Avatar className="size-8 shrink-0">
              {userImage && (
                <AvatarImage src={userImage} alt={userName ?? "User"} />
              )}
              <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                {initials}
              </AvatarFallback>
            </Avatar>
            {!effectiveCollapsed && (
              <div className="flex flex-col items-start min-w-0">
                <span className="text-sm font-medium truncate text-sidebar-foreground">
                  {userName ?? "User"}
                </span>
                {userEmail && (
                  <span className="text-xs text-muted-foreground truncate max-w-[160px]">
                    {userEmail}
                  </span>
                )}
              </div>
            )}
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
        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              href="/dashboard"
              onClick={() => isMobile && setOpenMobile(false)}
              className={navLinkClass(pathname === "/dashboard")}
            >
              <LayoutDashboard className="size-5 shrink-0" />
              {!effectiveCollapsed && <span>Dashboard</span>}
            </Link>
          </TooltipTrigger>
          {effectiveCollapsed && <TooltipContent side="right">Dashboard</TooltipContent>}
        </Tooltip>

        {/* Inbox — always pinned at the top, visually distinct */}
        {inboxSystem && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href={`/systems/${inboxSystem.id}`}
                onClick={() => isMobile && setOpenMobile(false)}
                className={cn(
                  "flex items-center px-3 py-2.5 rounded-md text-sm transition-colors border",
                  effectiveCollapsed ? "justify-center" : "gap-2.5",
                  pathname === `/systems/${inboxSystem.id}`
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium border-sidebar-border/60"
                    : "bg-sidebar-accent/20 border-sidebar-border/40 text-sidebar-foreground hover:bg-sidebar-accent/40"
                )}
              >
                <Inbox className={cn("size-5 shrink-0", `text-${getSystemColor(inboxSystem.color)}`)} />
                {!effectiveCollapsed && <span className="truncate font-medium">{inboxSystem.name}</span>}
              </Link>
            </TooltipTrigger>
            {effectiveCollapsed && <TooltipContent side="right">{inboxSystem.name}</TooltipContent>}
          </Tooltip>
        )}

        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              href="/systems"
              onClick={() => isMobile && setOpenMobile(false)}
              className={navLinkClass(pathname === "/systems")}
            >
              <Box className="size-5 shrink-0" />
              {!effectiveCollapsed && <span>Systems</span>}
            </Link>
          </TooltipTrigger>
          {effectiveCollapsed && <TooltipContent side="right">Systems</TooltipContent>}
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              href="/tasks"
              onClick={() => isMobile && setOpenMobile(false)}
              className={navLinkClass(pathname === "/tasks")}
            >
              <List className="size-5 shrink-0" />
              {!effectiveCollapsed && <span>Tasks</span>}
            </Link>
          </TooltipTrigger>
          {effectiveCollapsed && <TooltipContent side="right">Tasks</TooltipContent>}
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              href="/settings"
              onClick={() => isMobile && setOpenMobile(false)}
              className={navLinkClass(pathname === "/settings")}
            >
              <Settings className="size-5 shrink-0" />
              {!effectiveCollapsed && <span>Settings</span>}
            </Link>
          </TooltipTrigger>
          {effectiveCollapsed && <TooltipContent side="right">Settings</TooltipContent>}
        </Tooltip>

        <div className="my-3 border-t border-sidebar-border" />

        {!effectiveCollapsed && (
          <p className="px-3 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
            Systems
          </p>
        )}

        {/* Regular systems as collapsible tree items */}
        {isLoading && (
          <div className="space-y-1 p-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-10 rounded-md bg-muted motion-safe:animate-pulse" />
            ))}
          </div>
        )}

        {regularSystems.map((system: System) => (
          <SystemTreeItem
            key={system.id}
            system={system}
            isActive={activeSystemId === system.id}
            activeFolderId={activeFolderId ?? undefined}
            collapsed={effectiveCollapsed}
            onNavigate={() => isMobile && setOpenMobile(false)}
          />
        ))}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-sidebar-border">
        <CreateSystemDialog collapsed={effectiveCollapsed} />
      </div>
    </>
  );

  // Mobile: render as a Sheet drawer
  if (isMobile) {
    return (
      <Sheet open={openMobile} onOpenChange={setOpenMobile}>
        <SheetContent side="left" className="p-0 w-72 bg-sidebar flex flex-col">
          <SheetTitle className="sr-only">Menú de navegación</SheetTitle>
          <TooltipProvider delayDuration={0}>
            {sidebarContent}
          </TooltipProvider>
        </SheetContent>
      </Sheet>
    );
  }

  // Desktop: render as fixed sidebar
  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          "h-screen border-r border-sidebar-border bg-sidebar flex flex-col shrink-0 transition-all duration-300 overflow-hidden",
          collapsed ? "w-16" : "w-64"
        )}
      >
        {sidebarContent}
      </aside>
    </TooltipProvider>
  );
}
