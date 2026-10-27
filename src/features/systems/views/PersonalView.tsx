'use client';

import { useState } from 'react';
import { Check } from 'lucide-react';
import { MarginRow } from '@/components/ui/margin-row';
import { IndexHead } from '@/features/notebooks/IndexHead';
import { toRoman } from '@/features/notebooks/index-format';
import { NewTaskButton } from '../NewTaskButton';
import { TaskDetailSheet } from '@/features/tasks/TaskDetailSheet';
import { useTasks, useToggleTask } from '@/features/tasks/tasks.hooks';
import { conVisita, useTacharEnSitio } from '@/features/tasks/useTachar';
import type { TaskTransport } from '@/features/tasks/tasks.types';
import { useFolders } from '@/features/folders/folders.hooks';
import { capitalize, findTaskKind, resolveSystemManifest } from '@/shared/lib/system-manifest';
import { cn } from '@/lib/utils';
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
export const PersonalView = conVisita(function PersonalView({ system, initialTasks }: SystemViewProps) {
  const manifest = resolveSystemManifest(system);
  const { data: tasks = initialTasks } = useTasks(system.id, initialTasks);
  const { data: folders = [] } = useFolders(system.id);
  const { mutate: toggle } = useToggleTask(system.id);
  const { struck, handleToggle, estadoDe } = useTacharEnSitio(toggle);
  const [open, setOpen] = useState<TaskTransport | null>(null);

  // `today` es el estado de scheduling del plan de hoy, así que ya excluye lo
  // cerrado: una tarea completada sale del plan en la siguiente visita. Hasta
  // entonces se queda en su renglón, tachada, con su Deshacer.
  const hoy = tasks.filter((task) => estadoDe(task) === 'today');

  // Lo que hay dentro de un área son sus pendientes, no sus subcarpetas: sale
  // de las tareas ya cargadas y no cuesta una consulta por área.
  const pendientesPorArea = new Map<string, number>();
  for (const task of tasks) {
    if (!task.folderId || task.status === 'done') continue;
    pendientesPorArea.set(task.folderId, (pendientesPorArea.get(task.folderId) ?? 0) + 1);
  }

  return (
    <div className="space-y-7">
      <div className="flex items-center justify-end">
        <NewTaskButton systemId={system.id} />
      </div>

      <section aria-labelledby="personal-hoy">
        <IndexHead id="personal-hoy" title="Hoy" trailing={hoy.length > 0 ? String(hoy.length) : undefined} />
        {hoy.length === 0 ? (
          <p className="py-3 pl-(--margen) text-sm text-muted-foreground">
            Hoy no hay nada de este sistema en el plan.
          </p>
        ) : (
          <ul>
            {hoy.map((task) => {
              const kind = findTaskKind(manifest, task.metadata?.kind);
              const hecha = task.status === 'done';
              return (
                <li key={task.id} className="border-b border-border last:border-b-0">
                  <MarginRow
                    className="border-b-0"
                    data-struck={hecha ? '' : undefined}
                    margin={
                      <button
                        type="button"
                        aria-label={`Completar ${task.title}`}
                        aria-pressed={hecha}
                        onClick={() => handleToggle(task)}
                        className="press group/circulo -mt-[0.35rem] flex size-[2.85rem] items-center justify-center rounded-full transition-transform duration-(--dur-toque) ease-(--ease-pluma) focus-ring"
                      >
                        <span
                          aria-hidden
                          className={cn(
                            'flex size-[1.4rem] items-center justify-center rounded-full border-2 transition-[background-color,border-color,transform] duration-(--dur-tachar) ease-(--ease-pluma)',
                            hecha
                              ? cn(struck.has(task.id) && 'anim-tachar', 'border-task-done bg-task-done text-task-done-foreground')
                              : 'border-ln2 group-hover/circulo:border-ok',
                          )}
                        >
                          {hecha && <Check className="size-3" strokeWidth={3} />}
                        </span>
                      </button>
                    }
                    trailing={kind ? kind.label : undefined}
                  >
                    <button
                      type="button"
                      onClick={() => setOpen(task)}
                      className={cn(
                        'block w-full rounded-sm text-left font-semibold focus-ring',
                        hecha ? 'text-muted-foreground line-through' : 'text-foreground',
                      )}
                    >
                      {task.title}
                    </button>
                  </MarginRow>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="personal-areas">
        <IndexHead id="personal-areas" title={capitalize(manifest.folderRole?.nounPlural ?? 'carpetas')} />
        {folders.length === 0 ? (
          <p className="py-3 pl-(--margen) text-sm text-muted-foreground">
            Todavía no hay {manifest.folderRole?.nounPlural ?? 'carpetas'}. Lo que crees aquí
            aterriza directo en el sistema.
          </p>
        ) : (
          <div>
            {folders.map((folder, i) => {
              const pendientes = pendientesPorArea.get(folder.id) ?? 0;
              return (
                <MarginRow
                  key={folder.id}
                  href={`/systems/${system.id}/folders/${folder.id}`}
                  margin={
                    <span aria-hidden className="mt-[0.55rem] block font-display text-base leading-none font-bold">
                      {toRoman(i + 1)}
                    </span>
                  }
                  trailing={
                    <span>
                      <span className="font-semibold text-foreground">{pendientes}</span>
                      <span className="sr-only"> {pendientes === 1 ? 'pendiente' : 'pendientes'}</span>
                    </span>
                  }
                >
                  <span className="block truncate text-foreground">{folder.name}</span>
                </MarginRow>
              );
            })}
          </div>
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
});
