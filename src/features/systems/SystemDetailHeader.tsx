"use client";

import { useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ChevronDown, Download, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useDeleteSystem } from "./systems.hooks";
import { getSystemColor } from "@/shared/utils/system-colors";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EditSystemDialog } from "./EditSystemDialog";
import type { SystemTransport } from "./systems.types";
import Link from "next/link";
import { type SystemSignals, formatStaleAdvisor } from "./systems.signals";
import { capitalize, resolveSystemManifest } from "@/shared/lib/system-manifest";
import { cn } from "@/lib/utils";

interface SystemDetailHeaderProps {
  system: SystemTransport;
  signals: SystemSignals;
  currentTab?: "tasks" | "docs";
}

/** Los valores del enum, en español y en minúscula: van en una línea de meta. */
const ENERGY_LABEL: Record<string, string> = { high: "energía alta", medium: "energía media", low: "energía baja" };
const FREQUENCY_LABEL: Record<string, string> = { daily: "diario", weekly: "semanal", monthly: "mensual" };

/** Texto legible de la última actividad relativa a hoy. */
function activityLabel(daysSinceLastActivity: number | null): string {
  if (daysSinceLastActivity === null) return "sin actividad aún";
  if (daysSinceLastActivity === 0) return "última tarea hoy";
  if (daysSinceLastActivity === 1) return "última tarea ayer";
  return `sin actividad hace ${daysSinceLastActivity} días`;
}

// Preferencia de colapso del header, compartida entre sistemas y persistida en
// localStorage. useSyncExternalStore mantiene el SSR consistente (snapshot del
// servidor = abierto) sin disparar mismatch de hidratación.
const HEADER_OPEN_KEY = "systemHeaderOpen";
const headerOpenListeners = new Set<() => void>();

function subscribeHeaderOpen(cb: () => void) {
  headerOpenListeners.add(cb);
  return () => headerOpenListeners.delete(cb);
}
function readHeaderOpen() {
  return localStorage.getItem(HEADER_OPEN_KEY) !== "false";
}
function setHeaderOpen(value: boolean) {
  localStorage.setItem(HEADER_OPEN_KEY, String(value));
  headerOpenListeners.forEach((l) => l());
}

export function SystemDetailHeader({ system, signals, currentTab = "tasks" }: SystemDetailHeaderProps) {
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [triggerOpen, setTriggerOpen] = useState(false);
  const open = useSyncExternalStore(subscribeHeaderOpen, readHeaderOpen, () => true);
  const { mutate: deleteSystem } = useDeleteSystem();
  const cls = getSystemColor(system.color);

  const toggleOpen = () => setHeaderOpen(!open);
  const typeConfig = resolveSystemManifest(system);
  const TypeIcon = typeConfig.icon;
  const staleAdvisor = formatStaleAdvisor(system, signals);
  const nextDue = signals.nextDueDate ? new Date(signals.nextDueDate) : null;

  return (
    <div className="w-full">
      {/* Title row: toggles the detail */}
      <div className="flex items-start justify-between gap-3 min-w-0">
        <button
          type="button"
          onClick={toggleOpen}
          aria-expanded={open}
          className="flex items-center gap-3 flex-1 min-w-0 text-left"
        >
          <ChevronDown
            className={cn(
              "size-4 shrink-0 text-muted-foreground transition-transform",
              !open && "-rotate-90",
            )}
          />
          <span className={`size-3 rounded-full shrink-0 bg-${cls}`} />
          <h1 className="truncate font-display text-[1.41rem] font-bold tracking-[-0.02em]">
            {system.name}
          </h1>
          {system.isInbox && (
            <Badge variant="outline" className="shrink-0">Inbox</Badge>
          )}
          {!system.isActive && (
            <Badge variant="destructive" className="shrink-0">Inactivo</Badge>
          )}
          {!system.isInbox && signals.stale && (
            <Badge variant="warn" className="shrink-0 gap-1">
              <AlertTriangle className="size-3" />
              dormido
            </Badge>
          )}
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="secondary"
              size="icon-sm"
              aria-label={`Acciones de ${system.name}`}
              className="shrink-0"
            >
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            {!system.isInbox && (
              <DropdownMenuItem
                className="flex items-center gap-2"
                onClick={() => setEditOpen(true)}
              >
                <Pencil className="size-4" />
                Editar sistema
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              className="flex items-center gap-2"
              onClick={async () => {
                const res = await fetch(`/api/systems/${system.id}/export`);
                if (!res.ok) return;
                const data = await res.json();
                const blob = new Blob([JSON.stringify(data, null, 2)], {
                  type: "application/json;charset=utf-8",
                });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `${(system.name ?? "sistema").toLowerCase().replace(/[^a-z0-9]+/g, "-")}.json`;
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              <Download className="size-4" />
              Exportar JSON
            </DropdownMenuItem>
            {!system.isInbox && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive flex items-center gap-2"
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 className="size-4" />
                  Eliminar sistema
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {open && (
      <div className="mt-3 space-y-2.5">
      {/* Identity statement */}
      {system.identityStatement && (
        <p className="pl-6 text-[0.95rem] text-foreground/80">
          {system.identityStatement}
        </p>
      )}

      {/* Una línea de meta: el tipo, la energía ideal y la frecuencia, en texto */}
      <p className="flex flex-wrap items-center gap-x-1.5 pl-6 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <TypeIcon className="size-3.5" />
          {typeConfig.label}
        </span>
        {system.energyIdeal && <span>· {ENERGY_LABEL[system.energyIdeal] ?? system.energyIdeal}</span>}
        {system.expectedFrequency && <span>· {FREQUENCY_LABEL[system.expectedFrequency] ?? system.expectedFrequency}</span>}
      </p>

      {/* Trigger context: collapsible */}
      {system.triggerContext && (
        <div className="pl-6">
          <button
            onClick={() => setTriggerOpen((v) => !v)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronDown className={cn("size-3 transition-transform", triggerOpen && "rotate-180")} />
            <span className="font-medium">Contexto de activación</span>
          </button>
          {triggerOpen && (
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              {system.triggerContext}
            </p>
          )}
        </div>
      )}

      {/* Stats reactivos */}
      <div className="flex items-center gap-x-4 gap-y-1 flex-wrap pl-6 text-xs text-muted-foreground">
        <span>
          {signals.activeTaskCount} activa{signals.activeTaskCount !== 1 ? "s" : ""}
        </span>
        {nextDue && (
          <span>próxima: {format(nextDue, "d MMM", { locale: es })}</span>
        )}
        <span>{activityLabel(signals.daysSinceLastActivity)}</span>
      </div>

      {/* Advisor: solo cuando stale */}
      {staleAdvisor && (
        <div className="ml-6 flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-xs text-foreground/80">
          <AlertTriangle className="size-3.5 shrink-0 text-task-overdue" />
          <span>{staleAdvisor}</span>
        </div>
      )}
      </div>
      )}

      {/* Las pestañas: un segmento pill fuera de la cabecera; el elegido es el acento */}
      <div className="mt-4 inline-flex rounded-full bg-secondary p-1" role="tablist" aria-label="Contenido del sistema">
        {(
          [
            { tab: "tasks", label: "Tareas" },
            { tab: "docs", label: capitalize(typeConfig.pageRole.nounPlural) },
          ] as const
        ).map(({ tab, label }) => (
          <Link
            key={tab}
            role="tab"
            aria-selected={currentTab === tab}
            href={`/systems/${system.id}?tab=${tab}`}
            className={cn(
              "flex h-10 items-center rounded-full px-4 text-sm font-semibold transition-colors",
              currentTab === tab ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </Link>
        ))}
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Eliminar sistema"
        description={`"${system.name}" y todo su contenido se eliminarán permanentemente. Esta acción no se puede deshacer.`}
        onConfirm={() => {
          setConfirmDelete(false);
          deleteSystem(system.id, {
            onSuccess: () => router.push("/systems"),
          });
        }}
        onCancel={() => setConfirmDelete(false)}
      />

      <EditSystemDialog
        system={system}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
    </div>
  );
}
