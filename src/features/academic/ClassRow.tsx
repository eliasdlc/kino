"use client";

import { useState } from "react";
import { differenceInCalendarDays, startOfToday } from "date-fns";
import { FolderSymlink } from "lucide-react";
import type { FolderWithCounts } from "@/features/folders/folders.types";
import type { TaskTransport } from "@/features/tasks/tasks.types";
import { parseDueDate } from "@/features/tasks/tasks.utils";
import { FolderRow } from "@/features/notebooks/FolderRow";
import { joinMeta } from "@/features/notebooks/index-format";
import { cn } from "@/lib/utils";
import type { ArchetypeManifest } from "@/shared/lib/system-types";
import { MoveToCycleDialog } from "./MoveToCycleMenu";
import type { AcademicPeriod } from "./academic.hooks";

interface ClassRowProps {
  folder: FolderWithCounts;
  systemId: string;
  index: number;
  tasks: TaskTransport[];
  periods: AcademicPeriod[];
  href: string;
  /** El vocabulario del sistema, que la lista ya tiene. */
  manifest?: ArchetypeManifest;
}

/** Lo que falta por entregar en la clase. */
function pending(tasks: TaskTransport[]) {
  return tasks.filter((task) => !task.deletedAt && task.status !== "done");
}

/** La entrega más próxima, dicha en días. `null` si ninguna tiene fecha. */
export function nextDue(tasks: TaskTransport[], today: Date = startOfToday()): { label: string; overdue: boolean } | null {
  const dated = pending(tasks)
    .filter((task) => task.dueDate)
    .map((task) => differenceInCalendarDays(parseDueDate(task.dueDate as string), today))
    .sort((a, b) => a - b);
  if (dated.length === 0) return null;
  const days = dated[0];
  if (days < 0) return { label: days === -1 ? "vencida ayer" : `vencida hace ${Math.abs(days)} días`, overdue: true };
  if (days === 0) return { label: "entrega hoy", overdue: false };
  if (days === 1) return { label: "entrega mañana", overdue: false };
  return { label: `entrega en ${days} días`, overdue: false };
}

function metaString(metadata: Record<string, unknown> | null, key: string): string | null {
  const value = metadata?.[key];
  return typeof value === "string" && value.trim() ? value : null;
}

/**
 * Una clase en el índice de un sistema académico: quién la da y cuándo se ve
 * en la meta, cuántas cosas faltan, y la entrega más próxima a la derecha.
 * Vencida va en coral y siempre con la palabra delante.
 */
export function ClassRow({ folder, systemId, index, tasks, periods, href, manifest }: ClassRowProps) {
  const [moving, setMoving] = useState(false);
  const professor = metaString(folder.metadata as Record<string, unknown> | null, "professor");
  const schedule = metaString(folder.metadata as Record<string, unknown> | null, "schedule");
  const open = pending(tasks).length;
  const due = nextDue(tasks);

  return (
    <>
      <FolderRow
        folder={folder}
        systemId={systemId}
        index={index}
        href={href}
        manifest={manifest}
        meta={
          <>
            {due && (
              <>
                <span className={cn("font-semibold", due.overdue ? "text-task-overdue" : "text-foreground")}>{due.label}</span>
                {", "}
              </>
            )}
            {joinMeta([`${open} ${open === 1 ? "pendiente" : "pendientes"}`, professor, schedule])}
          </>
        }
        extraActions={[{ label: "Mover a ciclo", icon: FolderSymlink, onSelect: () => setMoving(true) }]}
      />
      <MoveToCycleDialog folder={folder} periods={periods} open={moving} onOpenChange={setMoving} />
    </>
  );
}
