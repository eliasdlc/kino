"use client";

import { useTrashedTasks, useRestoreTask } from "./tasks.hooks";
import { RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MarginRow } from "@/components/ui/margin-row";
import { SectionHead } from "@/features/dashboard/SectionHead";

/**
 * Papelera: lista las tareas con deleted_at IS NOT NULL del sistema y permite
 * restaurarlas. "Borrar" = deletedAt (papelera); "archivar" = status terminal:
 * son conceptos separados (PLAN-09 F2.3). Es una sección de Diario: el
 * título con la cuenta y su hairline, y una fila de margen por tarea con la
 * papelera en el margen, el título tachado y Restaurar en la cola.
 */
export function TaskTrashSection({ systemId }: { systemId: string }) {
  const { data: trashed = [], isLoading } = useTrashedTasks(systemId);
  const { mutate: restore } = useRestoreTask();

  if (isLoading || trashed.length === 0) return null;

  return (
    <section aria-labelledby="papelera-titulo" className="w-full pt-4">
      <SectionHead id="papelera-titulo" as="h3" title="Papelera" count={`${trashed.length} tarea${trashed.length === 1 ? "" : "s"}`} />
      {trashed.map((task) => (
        <MarginRow
          key={task.id}
          margin={<Trash2 className="mt-[0.8rem] size-4" />}
          trailing={
            <Button size="sm" variant="ghost" className="-mr-2" onClick={() => restore(task.id)}>
              <RotateCcw className="size-4" />
              Restaurar
            </Button>
          }
        >
          <span className="block truncate text-base text-muted-foreground line-through decoration-input">{task.title}</span>
        </MarginRow>
      ))}
    </section>
  );
}
