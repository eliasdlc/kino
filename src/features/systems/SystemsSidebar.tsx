"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, use, useEffect, useMemo } from "react";
import type { LucideIcon } from "lucide-react";
import { PanelLeftClose, PanelLeftOpen, Plus, Search } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { useSystems } from "./systems.hooks";
import { useTodayPlanTasks } from "@/features/tasks/tasks.hooks";
import { CreateSystemDialog } from "./CreateSystemDialog";
import { SidebarUserMenu } from "./SidebarUserMenu";
import type { SystemWithSignalsTransport } from "./systems.types";
import { useSystemsTreeStore } from "./systems.store";
import { useCommandPaletteStore } from "@/features/command-palette/command-palette.store";
import { SystemTreeItem } from "./SystemTreeItem";
import { DESTINOS, destinoActivo } from "@/components/navigation";
import { cn } from "@/lib/utils";

/** Lo que el menú de cuenta necesita de la fila de `users`. Llega como promesa, en streaming. */
export interface CuentaDelSidebar {
  name?: string;
  email?: string;
  image: string | null;
}

interface SystemsSidebarProps {
  cuenta: Promise<CuentaDelSidebar>;
}

interface NavItemProps {
  href: string;
  icon: LucideIcon;
  label: string;
  active: boolean;
  collapsed: boolean;
  badge?: number;
}

/**
 * Un destino del sidebar. El activo va en tinta sobre sf2, como toda
 * selección de Diario; el ámbar queda para la acción. El contador va en mute,
 * como todo numeral.
 */
function NavItem({ href, icon: Icon, label, active, collapsed, badge }: NavItemProps) {
  const link = (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group flex h-10 items-center rounded-full text-sm transition-colors duration-(--dur-toque) ease-(--ease-pluma) focus-ring",
        collapsed ? "justify-center" : "gap-3 px-3",
        active
          ? "bg-sidebar-accent font-semibold text-sidebar-foreground"
          : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
      )}
    >
      <span className="relative shrink-0">
        <Icon className="size-5" strokeWidth={active ? 2 : 1.8} />
        {collapsed && badge ? (
          <span className="absolute -top-1 -right-1 size-2 rounded-full bg-muted-foreground ring-2 ring-sidebar" />
        ) : null}
      </span>
      {!collapsed && <span className="flex-1 truncate">{label}</span>}
      {!collapsed && badge ? (
        <span className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground">{badge}</span>
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

/** El menú de cuenta, cuando la fila de `users` llega. */
function MenuDeCuenta({ cuenta, collapsed }: { cuenta: Promise<CuentaDelSidebar>; collapsed: boolean }) {
  const user = use(cuenta);
  return (
    <SidebarUserMenu
      userName={user.name}
      userEmail={user.email}
      userImage={user.image}
      collapsed={collapsed}
    />
  );
}

function MenuDeCuentaEsperando({ collapsed }: { collapsed: boolean }) {
  return (
    <div className={cn("flex items-center gap-2.5 p-1.5", collapsed && "justify-center")}>
      <Skeleton className="size-8 shrink-0 rounded-full" />
      {!collapsed && (
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-3 w-32" />
        </div>
      )}
    </div>
  );
}

/**
 * El sidebar de escritorio: la marca, Buscar, los destinos de la lista única
 * de navegación, el árbol de sistemas y la cuenta. Sólo existe desde `md`,
 * y lo decide el CSS (`hidden md:flex`), no un hook: así un teléfono nunca
 * pinta el sidebar antes de hidratar. El teléfono no tiene menú lateral: sus
 * destinos están en el pie y la cuenta en Ajustes.
 *
 * Colapsar cambia el ancho sin animarlo: el ancho es layout y no se anima.
 */
export function SystemsSidebar({ cuenta }: SystemsSidebarProps) {
  const pathname = usePathname();
  const { data: systems, isLoading } = useSystems();
  const { data: todayTasks } = useTodayPlanTasks();
  const setOnlyExpanded = useSystemsTreeStore((s) => s.setOnlyExpanded);
  const collapsed = useSystemsTreeStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useSystemsTreeStore((s) => s.toggleSidebar);
  const pinnedIds = useSystemsTreeStore((s) => s.pinnedIds);
  const openPalette = useCommandPaletteStore((s) => s.setOpen);

  const activeSystemId = useMemo(() => {
    const match = pathname.match(/^\/systems\/([^/]+)/);
    return match?.[1] ?? null;
  }, [pathname]);

  const activeFolderId = useMemo(() => {
    const match = pathname.match(/^\/systems\/[^/]+\/folders\/([^/]+)/);
    return match?.[1] ?? null;
  }, [pathname]);

  // El sistema activo se despliega solo y los demás se pliegan.
  useEffect(() => {
    if (activeSystemId) setOnlyExpanded(activeSystemId);
  }, [activeSystemId, setOnlyExpanded]);

  const regularSystems = systems?.filter((s) => !s.isInbox) ?? [];

  // Los fijados van arriba, en el orden en que se fijaron; el resto detrás.
  const pinnedSet = new Set(pinnedIds);
  const pinnedSystems = pinnedIds
    .map((id) => regularSystems.find((s) => s.id === id))
    .filter((s): s is SystemWithSignalsTransport => Boolean(s));
  const restSystems = regularSystems.filter((s) => !pinnedSet.has(s.id));
  const orderedSystems = [...pinnedSystems, ...restSystems];

  const todayRemaining = todayTasks?.filter((t) => t.status !== "done").length ?? 0;

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        aria-label="Navegación"
        className={cn(
          "hidden h-dvh shrink-0 flex-col overflow-hidden border-r border-sidebar-border bg-sidebar md:flex",
          collapsed ? "w-16" : "w-64",
        )}
      >
        {/* La marca y el botón de plegar */}
        <div className={cn("flex h-14 shrink-0 items-center px-3", collapsed ? "justify-center" : "justify-between")}>
          {!collapsed && (
            <Link
              href="/dashboard"
              className="rounded-md px-1 font-display text-lg font-bold tracking-[-0.02em] text-sidebar-foreground focus-ring"
            >
              Kino
            </Link>
          )}
          <button
            type="button"
            onClick={toggleSidebar}
            aria-label={collapsed ? "Expandir panel" : "Contraer panel"}
            className="grid size-9 place-items-center rounded-full text-muted-foreground transition-colors duration-(--dur-toque) ease-(--ease-pluma) hover:bg-sidebar-accent hover:text-sidebar-foreground focus-ring"
          >
            {collapsed ? <PanelLeftOpen className="size-5" /> : <PanelLeftClose className="size-5" />}
          </button>
        </div>

        {/* Buscar abre la paleta */}
        <div className="shrink-0 px-3 pb-2">
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => openPalette(true)}
                  aria-label="Buscar"
                  className="flex h-10 w-full items-center justify-center rounded-full text-muted-foreground transition-colors duration-(--dur-toque) ease-(--ease-pluma) hover:bg-sidebar-accent hover:text-sidebar-foreground focus-ring"
                >
                  <Search className="size-5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">Buscar (Ctrl K)</TooltipContent>
            </Tooltip>
          ) : (
            <button
              type="button"
              onClick={() => openPalette(true)}
              className="flex h-10 w-full items-center gap-2.5 rounded-full border border-input px-3 text-sm text-muted-foreground transition-colors duration-(--dur-toque) ease-(--ease-pluma) hover:bg-sidebar-accent hover:text-sidebar-foreground focus-ring"
            >
              <Search className="size-4 shrink-0" />
              <span className="flex-1 text-left">Buscar</span>
              <kbd className="rounded-md border border-sidebar-border bg-sidebar px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
                Ctrl K
              </kbd>
            </button>
          )}
        </div>

        {/* Destinos y sistemas */}
        <nav aria-label="Secciones" className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-3">
          {DESTINOS.map((destino) => (
            <NavItem
              key={destino.href}
              href={destino.href}
              icon={destino.icon}
              label={destino.label}
              active={destinoActivo(destino.href, pathname)}
              collapsed={collapsed}
              badge={destino.href === "/tasks" ? todayRemaining : undefined}
            />
          ))}

          <div className={cn("flex items-center pt-4 pb-1", collapsed ? "justify-center px-0" : "justify-between px-3")}>
            {!collapsed && (
              <span className="text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">Sistemas</span>
            )}
            <CreateSystemDialog
              trigger={
                <button
                  type="button"
                  aria-label="Nuevo sistema"
                  className="grid size-8 place-items-center rounded-full text-muted-foreground transition-colors duration-(--dur-toque) ease-(--ease-pluma) hover:bg-sidebar-accent hover:text-sidebar-foreground focus-ring"
                >
                  <Plus className="size-4" />
                </button>
              }
            />
          </div>

          {isLoading && (
            <div className="space-y-1 py-1">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-9 rounded-full" />
              ))}
            </div>
          )}

          {orderedSystems.map((system) => (
            <SystemTreeItem
              key={system.id}
              system={system}
              isActive={activeSystemId === system.id}
              activeFolderId={activeFolderId ?? undefined}
              collapsed={collapsed}
              isPinned={pinnedSet.has(system.id)}
            />
          ))}

          {!isLoading && orderedSystems.length === 0 && !collapsed && (
            <p className="px-3 py-2 font-voice text-sm italic text-body">Todavía no hay sistemas.</p>
          )}
        </nav>

        {/* La cuenta */}
        <div className="shrink-0 border-t border-sidebar-border p-2">
          <Suspense fallback={<MenuDeCuentaEsperando collapsed={collapsed} />}>
            <MenuDeCuenta cuenta={cuenta} collapsed={collapsed} />
          </Suspense>
        </div>
      </aside>
    </TooltipProvider>
  );
}
