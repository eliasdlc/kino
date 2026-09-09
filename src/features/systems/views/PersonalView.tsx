'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CreateTaskDialog } from '@/features/tasks/CreateTaskDialog';
import { TaskDetailSheet } from '@/features/tasks/TaskDetailSheet';
import { useTasks, useToggleTask } from '@/features/tasks/tasks.hooks';
import type { TaskTransport } from '@/features/tasks/tasks.types';
import { useFolders } from '@/features/folders/folders.hooks';
import { findTaskKind, resolveSystemManifest } from '@/shared/lib/system-manifest';
import type { SystemViewProps } from './SystemDetailView';

/**
 * La vista de un sistema cuyo contenedor es un área: algo que no se termina,
 * como la salud o los papeles.
 *
 * Lo de hoy va arriba porque es lo único con hora de caducidad: un hábito que
 * no se hizo hoy no se hizo, y un evento que pasó pasó. Las áreas van debajo,
 * porque son el contenedor navegable que el manifiesto declara y no cambian de
 * un día para otro.
 *
 * Todo el vocabulario sale del manifiesto efectivo del sistema: el plural del
 * contenedor y el nombre de cada tipo de tarea. Ni un `if` por tipo.
 */
export function PersonalView({ system, initialTasks }: SystemViewProps) {
  const manifest = resolveSystemManifest(system);
  const { data: tasks = initialTasks } = useTasks(system.id, initialTasks);
  const { data: folders = [] } = useFolders(system.id);
  const { mutate: toggle } = useToggleTask(system.id);
  const [open, setOpen] = useState<TaskTransport | null>(null);

  // `today` es el estado de scheduling del plan de hoy, así que ya excluye lo
  // cerrado: una tarea completada sale del plan.
  const hoy = tasks.filter((task) => task.status === 'today');

  // Lo que hay dentro de un área son sus pendientes, no sus subcarpetas: sale
  // de las tareas ya cargadas y no cuesta una consulta por área.
  const pendientesPorArea = new Map<string, number>();
  for (const task of tasks) {
    if (!task.folderId || task.status === 'done') continue;
    pendientesPorArea.set(task.folderId, (pendientesPorArea.get(task.folderId) ?? 0) + 1);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <CreateTaskDialog systemId={system.id} />
      </div>

      <section aria-labelledby="personal-hoy" className="space-y-1">
        <h3 id="personal-hoy" className="text-xs font-bold tracking-[0.12em] text-muted-foreground uppercase">
          Hoy
        </h3>
        {hoy.length === 0 ? (
          <p className="pt-1 text-sm text-muted-foreground">
            Hoy no hay nada de este sistema en el plan.
          </p>
        ) : (
          <ul>
            {hoy.map((task) => {
              const kind = findTaskKind(manifest, task.metadata?.kind);
              return (
                <li key={task.id} className="flex items-center gap-3 border-b border-border last:border-0">
                  <button
                    type="button"
                    aria-label={`Completar ${task.title}`}
                    onClick={() => toggle(task.id)}
                    className="ml-1 size-5 shrink-0 rounded-sm border-2 border-input transition-colors hover:border-primary"
                  />
                  <button
                    type="button"
                    onClick={() => setOpen(task)}
                    className="min-h-12 min-w-0 flex-1 truncate py-3 text-left text-sm"
                  >
                    {task.title}
                  </button>
                  {kind && (
                    <span className="shrink-0 text-xs text-muted-foreground">{kind.label}</span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="personal-areas" className="space-y-1">
        <h3
          id="personal-areas"
          className="text-xs font-bold tracking-[0.12em] text-muted-foreground uppercase"
        >
          {manifest.folderRole?.nounPlural ?? 'Carpetas'}
        </h3>
        {folders.length === 0 ? (
          <p className="pt-1 text-sm text-muted-foreground">
            Todavía no hay {manifest.folderRole?.nounPlural ?? 'carpetas'}. Lo que crees aquí
            aterriza directo en el sistema.
          </p>
        ) : (
          <ul>
            {folders.map((folder) => (
              <li key={folder.id} className="border-b border-border last:border-0">
                <Link
                  href={`/systems/${system.id}/folders/${folder.id}`}
                  className="flex min-h-12 items-center gap-3 py-3 text-sm"
                >
                  <span className="min-w-0 flex-1 truncate">{folder.name}</span>
                  <span className="shrink-0 font-mono text-xs text-muted-foreground tabular-nums">
                    {pendientesPorArea.get(folder.id) ?? 0}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <TaskDetailSheet
        task={open}
        systemId={system.id}
        open={open !== null}
        onOpenChange={(next) => !next && setOpen(null)}
      />
    </div>
  );
}
