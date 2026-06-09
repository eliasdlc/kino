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
import { AlertTriangle, ChevronDown, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useDeleteSystem } from "./systems.hooks";
import { getSystemColor } from "@/shared/utils/system-colors";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EditSystemDialog } from "./EditSystemDialog";
import type { System } from "./systems.types";
import { type SystemSignals, formatStaleAdvisor } from "./systems.signals";
import { SYSTEM_TYPE_CONFIG, type SystemType } from "@/shared/lib/system-types";
import { cn } from "@/lib/utils";

interface SystemDetailHeaderProps {
  system: System;
  signals: SystemSignals;
}

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

export function SystemDetailHeader({ system, signals }: SystemDetailHeaderProps) {
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [triggerOpen, setTriggerOpen] = useState(false);
  const open = useSyncExternalStore(subscribeHeaderOpen, readHeaderOpen, () => true);
  const { mutate: deleteSystem } = useDeleteSystem();
  const cls = getSystemColor(system.color);

  const toggleOpen = () => setHeaderOpen(!open);
  const typeConfig = SYSTEM_TYPE_CONFIG[(system.templateType ?? 'custom') as SystemType];
  const TypeIcon = typeConfig.icon;
  const staleAdvisor = formatStaleAdvisor(system, signals);
  const nextDue = signals.nextDueDate ? new Date(signals.nextDueDate) : null;

  return (
    <div className={`rounded-lg px-4 py-3 w-full bg-${cls}/10`}>
      {/* Title row — toggles the detail */}
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
          <h1 className="text-xl md:text-2xl font-bold tracking-tight truncate">
            {system.name}
          </h1>
          {system.isInbox && (
            <Badge variant="outline" className="shrink-0">Inbox</Badge>
          )}
          {!system.isActive && (
            <Badge variant="destructive" className="shrink-0">Inactive</Badge>
          )}
          {!system.isInbox && signals.stale && (
            <Badge
              variant="outline"
              className="shrink-0 gap-1 border-amber-500/40 text-amber-600 dark:text-amber-500"
            >
              <AlertTriangle className="size-3" />
              Stale
            </Badge>
          )}
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" className="shrink-0 size-9">
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            {!system.isInbox && (
              <DropdownMenuItem
                className="flex items-center gap-2"
                onClick={() => setEditOpen(true)}
              >
                <Pencil className="size-4" />
                Edit system
              </DropdownMenuItem>
            )}
            {!system.isInbox && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive flex items-center gap-2"
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 className="size-4" />
                  Delete system
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
        <p className="text-sm text-muted-foreground italic pl-6">
          &ldquo;{system.identityStatement}&rdquo;
        </p>
      )}

      {/* Type + metadata badges */}
      <div className="flex items-center gap-2 flex-wrap pl-6">
        <Badge variant="secondary" className="flex items-center gap-1.5">
          <TypeIcon className="size-3" />
          {typeConfig.label}
        </Badge>
        {system.energyIdeal && (
          <Badge variant="secondary">{system.energyIdeal}</Badge>
        )}
        {system.expectedFrequency && (
          <Badge variant="secondary">{system.expectedFrequency}</Badge>
        )}
      </div>

      {/* Trigger context — collapsible */}
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

      {/* Advisor — solo cuando stale */}
      {staleAdvisor && (
        <div className="flex items-start gap-2 ml-6 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-700 dark:text-amber-500">
          <AlertTriangle className="size-3.5 shrink-0 mt-0.5" />
          <span>{staleAdvisor}</span>
        </div>
      )}
      </div>
      )}

      <ConfirmDialog
        open={confirmDelete}
        title="Delete system"
        description={`"${system.name}" and all its content will be permanently deleted. This action cannot be undone.`}
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
