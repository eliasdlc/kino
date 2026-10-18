"use client";

import Link from "next/link";
import { Inbox, Pencil, Trash2 } from "lucide-react";
import { MarginRow } from "@/components/ui/margin-row";
import { RowActions } from "@/features/notebooks/RowActions";
import { formatCount, joinMeta } from "@/features/notebooks/index-format";
import { resolveSystemManifest } from "@/shared/lib/system-manifest";
import { cn } from "@/lib/utils";
import { ICON_MAP } from "./system-icons";
import { systemGlyphStyle } from "./system-tint";
import type { SystemWithSignalsTransport } from "./systems.types";

/** "activo hoy", "activo ayer", "hace 12 días", "sin actividad". */
export function activityLabel(days: number | null): string {
  if (days === null) return "sin actividad";
  if (days === 0) return "activo hoy";
  if (days === 1) return "activo ayer";
  return `hace ${days} días`;
}

interface SystemRowProps {
  system: SystemWithSignalsTransport;
  onEdit?: () => void;
  onDelete?: () => void;
}

/**
 * Un sistema como fila del índice de Sistemas: su glifo, en su color, en el
 * margen; el nombre; y en la meta el tipo, lo activo y la última actividad,
 * con "dormido" en coral delante cuando lo está. La Bandeja es una fila más,
 * la primera, y lleva a la pantalla de Bandeja, que es el nombre con el que la
 * conoce el pie de página.
 */
export function SystemRow({ system, onEdit, onDelete }: SystemRowProps) {
  const manifest = resolveSystemManifest(system);
  const Icon = system.isInbox ? Inbox : (ICON_MAP[system.icon ?? ""] ?? manifest.icon);
  const count = system.activeTaskCount;
  const href = system.isInbox ? "/bandeja" : `/systems/${system.id}`;
  const name = system.isInbox ? "Bandeja" : system.name;

  const meta = system.isInbox
    ? count === 0 ? "Nada sin repartir" : `${formatCount(count)} sin repartir`
    : joinMeta([
        manifest.label,
        `${formatCount(count)} ${count === 1 ? "activa" : "activas"}`,
        activityLabel(system.daysSinceLastActivity),
      ]);

  return (
    <MarginRow
      data-system-row=""
      margin={<Icon aria-hidden className="mt-[0.45rem] size-5" strokeWidth={1.8} style={system.isInbox ? undefined : systemGlyphStyle(system.color)} />}
      trailing={
        !system.isInbox && onEdit && onDelete ? (
          <RowActions
            subject={system.name}
            actions={[
              { label: "Editar", icon: Pencil, onSelect: onEdit },
              { label: "Eliminar", icon: Trash2, destructive: true, onSelect: onDelete },
            ]}
          />
        ) : undefined
      }
      className="group relative min-h-[3.75rem] has-[a:hover]:bg-sf2/60"
    >
      <Link
        href={href}
        className={cn(
          "line-clamp-2 rounded-sm font-semibold text-foreground focus-ring after:absolute after:inset-0 after:content-['']",
        )}
      >
        {name}
      </Link>
      <span className="line-clamp-2 text-sm text-muted-foreground">
        {system.stale && !system.isInbox && <span className="font-semibold text-task-overdue">dormido, </span>}
        {meta}
      </span>
    </MarginRow>
  );
}
