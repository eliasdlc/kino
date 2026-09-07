"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Calendar,
  Inbox,
  LayoutDashboard,
  ListTodo,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useSystems } from "./systems.hooks";
import { useTodayPlanTasks } from "@/features/tasks/tasks.hooks";
import { CreateSystemDialog } from "./CreateSystemDialog";
import { SidebarUserMenu } from "./SidebarUserMenu";
import type { SystemWithSignalsTransport } from "./systems.types";
import { useSystemsTreeStore } from "./systems.store";
import { useCommandPaletteStore } from "@/features/command-palette/command-palette.store";
import { SystemTreeItem } from "./SystemTreeItem";
import { getSystemColor } from "@/shared/utils/system-colors";
import { cn } from "@/lib/utils";
import { useSidebar } from "@/components/ui/sidebar";

interface SystemsSidebarProps {
  userName?: string;
  userEmail?: string;
  userImage?: string | null;
}

interface NavItemProps {
  href: string;
  icon: LucideIcon;
  label: string;
  active: boolean;
  collapsed: boolean;
  /** Tailwind bg class for the active accent bar / collapsed dot. */
  accent?: string;
  badge?: number;
  onNavigate?: () => void;
}

function NavItem({
  href,
  icon: Icon,
  label,
  active,
  collapsed,
  accent = "bg-sidebar-primary",
  badge,
  onNavigate,
}: NavItemProps) {
  const link = (
    <Link
      href={href}
      onClick={onNavigate}
      className={cn(
        "group relative flex items-center rounded-lg text-sm motion-safe:transition-colors",
        collapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2",
        active
          ? "bg-sidebar-accent text-sidebar-foreground font-medium"
          : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
      )}
    >
      {active && !collapsed && (
        <span
          className={cn(
            "absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 rounded-r-full",
            accent
          )}
        />
      )}
      <span className="relative shrink-0">
        <Icon className="size-5" />
        {collapsed && badge ? (
          <span
            className={cn(
              "absolute -right-1 -top-1 size-2 rounded-full ring-2 ring-sidebar",
              accent
            )}
          />
        ) : null}
      </span>
      {!collapsed && <span className="flex-1 truncate">{label}</span>}
      {!collapsed && badge ? (
        <span className="shrink-0 rounded-full bg-sidebar-accent px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground group-hover:text-sidebar-foreground">
          {badge}
        </span>
      ) : null}
    </Link>
  );

  if (!collapsed) return link;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}

export function SystemsSidebar({
  userName,
  userEmail,
  userImage,
}: SystemsSidebarProps) {
  const pathname = usePathname();
  const { data: systems, isLoading } = useSystems();
  const { data: todayTasks } = useTodayPlanTasks();
  const setOnlyExpanded = useSystemsTreeStore((s) => s.setOnlyExpanded);
  const collapsed = useSystemsTreeStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useSystemsTreeStore((s) => s.toggleSidebar);
  const pinnedIds = useSystemsTreeStore((s) => s.pinnedIds);
  const openPalette = useCommandPaletteStore((s) => s.setOpen);
  const { isMobile, openMobile, setOpenMobile } = useSidebar();

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

  const inboxSystem = systems?.find((s) => s.isInbox);
  const regularSystems = systems?.filter((s) => !s.isInbox) ?? [];

  // Pinned systems float to the top of the list (in pin order); the rest follow.
  const pinnedSet = new Set(pinnedIds);
  const pinnedSystems = pinnedIds
    .map((id) => regularSystems.find((s) => s.id === id))
    .filter((s): s is SystemWithSignalsTransport => Boolean(s));
  const restSystems = regularSystems.filter((s) => !pinnedSet.has(s.id));
  const orderedSystems = [...pinnedSystems, ...restSystems];

  const todayRemaining =
    todayTasks?.filter((t) => t.status !== "done").length ?? 0;

  // On mobile the sheet always shows the full sidebar.
  const effectiveCollapsed = isMobile ? false : collapsed;

  const closeOnMobile = () => isMobile && setOpenMobile(false);

  const sidebarContent = (
    <>
      {/* Brand + collapse toggle */}
      <div
        className={cn(
          "flex items-center h-14 px-3 shrink-0",
          effectiveCollapsed ? "justify-center" : "justify-between"
        )}
      >
        {!effectiveCollapsed && (
          <Link
            href="/dashboard"
            onClick={closeOnMobile}
            className="flex items-center gap-2 font-semibold text-lg tracking-tight text-sidebar-foreground"
          >
            <span className="grid size-7 place-items-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground text-sm font-bold">
              K
            </span>
            Kino
          </Link>
        )}
        {!isMobile && (
          <button
            onClick={toggleSidebar}
            aria-label={effectiveCollapsed ? "Expandir panel" : "Contraer panel"}
            className="p-1.5 rounded-md text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground motion-safe:transition-colors"
          >
            {effectiveCollapsed ? (
              <PanelLeftOpen className="size-5" />
            ) : (
              <PanelLeftClose className="size-5" />
            )}
          </button>
        )}
      </div>

      {/* Search → command palette */}
      <div className="px-3 pb-2 shrink-0">
        {effectiveCollapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => openPalette(true)}
                aria-label="Buscar"
                className="flex w-full items-center justify-center rounded-lg p-2.5 text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground motion-safe:transition-colors"
              >
                <Search className="size-5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">Buscar · ⌘K</TooltipContent>
          </Tooltip>
        ) : (
          <button
            onClick={() => openPalette(true)}
            className="flex w-full items-center gap-2.5 rounded-lg border border-sidebar-border bg-sidebar-accent/40 px-3 py-2 text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground motion-safe:transition-colors"
          >
            <Search className="size-4 shrink-0" />
            <span className="flex-1 text-left">Buscar</span>
            <kbd className="rounded border border-sidebar-border bg-sidebar px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              ⌘K
            </kbd>
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 pb-3 space-y-0.5">
        <NavItem
          href="/dashboard"
          icon={LayoutDashboard}
          label="Hoy"
          active={pathname === "/dashboard"}
          collapsed={effectiveCollapsed}
          onNavigate={closeOnMobile}
        />

        {inboxSystem && (
          <NavItem
            href={`/systems/${inboxSystem.id}`}
            icon={Inbox}
            label={inboxSystem.name}
            active={pathname === `/systems/${inboxSystem.id}`}
            collapsed={effectiveCollapsed}
            accent={`bg-${getSystemColor(inboxSystem.color)}`}
            badge={inboxSystem.activeTaskCount}
            onNavigate={closeOnMobile}
          />
        )}

        <NavItem
          href="/tasks"
          icon={ListTodo}
          label="Tareas"
          active={pathname === "/tasks"}
          collapsed={effectiveCollapsed}
          badge={todayRemaining}
          onNavigate={closeOnMobile}
        />

        <NavItem
          href="/calendar"
          icon={Calendar}
          label="Calendario"
          active={pathname === "/calendar"}
          collapsed={effectiveCollapsed}
          onNavigate={closeOnMobile}
        />

        {/* Systems section header */}
        <div
          className={cn(
            "flex items-center pt-4 pb-1",
            effectiveCollapsed ? "justify-center px-0" : "justify-between px-3"
          )}
        >
          {!effectiveCollapsed && (
            <Link
              href="/systems"
              onClick={closeOnMobile}
              className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70 hover:text-sidebar-foreground motion-safe:transition-colors"
            >
              Sistemas
            </Link>
          )}
          <CreateSystemDialog
            trigger={
              <button
                aria-label="Nuevo sistema"
                className="grid place-items-center size-6 rounded-md text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground motion-safe:transition-colors"
              >
                <Plus className="size-4" />
              </button>
            }
          />
        </div>

        {isLoading && (
          <div className="space-y-1 py-1">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-9 rounded-lg bg-muted motion-safe:animate-pulse" />
            ))}
          </div>
        )}

        {orderedSystems.map((system) => (
          <SystemTreeItem
            key={system.id}
            system={system}
            isActive={activeSystemId === system.id}
            activeFolderId={activeFolderId ?? undefined}
            collapsed={effectiveCollapsed}
            isPinned={pinnedSet.has(system.id)}
            onNavigate={closeOnMobile}
          />
        ))}

        {!isLoading && orderedSystems.length === 0 && !effectiveCollapsed && (
          <p className="px-3 py-2 text-xs text-muted-foreground/60">
            Aún no tienes sistemas.
          </p>
        )}
      </nav>

      {/* Footer: user */}
      <div className="p-2 border-t border-sidebar-border shrink-0">
        <SidebarUserMenu
          userName={userName}
          userEmail={userEmail}
          userImage={userImage}
          collapsed={effectiveCollapsed}
        />
      </div>
    </>
  );

  // Mobile: render as a Sheet drawer
  if (isMobile) {
    return (
      <Sheet open={openMobile} onOpenChange={setOpenMobile}>
        <SheetContent side="left" className="p-0 w-72 bg-sidebar flex flex-col">
          <SheetTitle className="sr-only">Menú de navegación</SheetTitle>
          <TooltipProvider delayDuration={0}>{sidebarContent}</TooltipProvider>
        </SheetContent>
      </Sheet>
    );
  }

  // Desktop: fixed sidebar
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
