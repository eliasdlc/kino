'use client';

import { useState } from 'react';
import { CalendarPlus, Check } from 'lucide-react';
import { toast } from 'sonner';
import { EmptyState } from '@/components/ui/empty-state';
import { SectionHead } from '@/features/dashboard/SectionHead';
import { EnergyBudgetBar } from '@/features/energy/EnergyBudgetBar';
import { useEnergyBudget } from '@/features/energy/energy.hooks';
import { crossesLimitWith } from '@/features/energy/energy.budget';
import { useSuggestedTasks, useAddToTodayPlan, useToggleTodayTask, type SuggestedTask } from './tasks.hooks';
import { TaskDetailSheet } from './TaskDetailSheet';
import { TaskRow } from './TaskRow';
import { useListaTachable } from './useTachar';
import { LISTA_FILA_ALTO, ListaSkeleton } from './TasksSkeleton';
import type { TaskTransport } from './tasks.types';

/** Cuántas sugerencias se ven: siete caben en una pantalla de teléfono sin volverse otra lista. */
const VISIBLES = 7;

/**
 * Agregar al plan, en la cola de la fila: 48 px, el glifo y su estado. Ya en
 * el plan se queda en su sitio con el check en --ok y deja de ser botón.
 */
function AddToPlan({ added, onAdd, title }: { added: boolean; onAdd: () => void; title: string }) {
  if (added) {
    return (
      <span className="-mr-2 inline-flex size-[2.85rem] items-center justify-center text-task-done" aria-label={`${title} ya está en el plan`} role="img">
        <Check className="size-[1.1rem]" strokeWidth={2.4} />
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={onAdd}
      aria-label={`Agregar ${title} al plan de hoy`}
      className="press focus-ring -mr-2 inline-flex size-[2.85rem] items-center justify-center rounded-full text-muted-foreground transition-[color,transform] duration-(--dur-toque) ease-(--ease-pluma) hover:text-primary"
    >
      <CalendarPlus className="size-[1.1rem]" />
    </button>
  );
}

/**
 * Lo sugerido para hoy: un título con hairline, el presupuesto de energía en
 * la columna de texto (aceptar sugerencias es comprometer el día, así que el
 * presupuesto se ve aquí mismo) y hasta siete filas. La meta es la de toda
 * fila de tarea (vencida, prioridad, energía), que ya es el porqué que manda
 * el servidor dicho con el vocabulario común. Agregar al plan es la cola de
 * cada fila; completar, el círculo, con la fila tachada en su sitio y Deshacer.
 */
export function KinoSuggestedSection() {
  const { data: suggestions = [], isLoading } = useSuggestedTasks();
  const { mutate: addToPlan } = useAddToTodayPlan();
  const { mutate: complete } = useToggleTodayTask();
  const budget = useEnergyBudget();

  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [selectedTask, setSelectedTask] = useState<TaskTransport | null>(null);

  const { filas, struck, handleToggle } = useListaTachable(suggestions.slice(0, VISIBLES), (taskId) => complete({ taskId }));

  function handleAdd(task: SuggestedTask) {
    // Aviso en el cruce exacto del presupuesto (D2: avisa, jamás bloquea). Solo
    // al cruzar: ya en sobregiro no se repite en cada tarea que se agregue.
    if (budget) {
      const { crosses, overBy, next } = crossesLimitWith(budget, task);
      if (crosses) {
        // La cifra delante y el día como sujeto, igual que la salida del
        // sobregiro.
        toast(`El día quedaría en ${next} de ${budget.limit} puntos`, {
          description: `${overBy} por encima. Nada se bloquea.`,
        });
      }
    }
    addToPlan({ taskId: task.id });
    setAddedIds((prev) => new Set([...prev, task.id]));
  }

  return (
    <section aria-labelledby="sugerido-titulo">
      <SectionHead id="sugerido-titulo" title="Sugerido para hoy" count={isLoading || filas.length === 0 ? undefined : `${filas.length} tarea${filas.length === 1 ? '' : 's'}`} />

      <EnergyBudgetBar className="py-3 pl-(--margen)" />

      {isLoading ? (
        <ListaSkeleton filas={3} />
      ) : filas.length === 0 ? (
        <EmptyState
          className="pl-(--margen)"
          title={suggestions.length === 0 ? 'Nada que sugerir' : 'Todo lo sugerido está en el plan'}
          description={suggestions.length === 0 ? 'No quedan tareas abiertas. El resto del día es tuyo.' : 'Lo que sigue lo eliges tú, desde la lista de abajo.'}
        />
      ) : (
        <div>
          {filas.map((task) => {
            const added = addedIds.has(task.id) || task.inTodayPlan;
            return (
              <TaskRow
                key={task.id}
                task={task}
                density="plan"
                className={LISTA_FILA_ALTO}
                struck={struck.has(task.id)}
                onComplete={() => handleToggle(task)}
                onOpen={() => setSelectedTask(task)}
                trailing={
                  task.status === 'done' ? (
                    <span className="-mr-2 block size-[2.85rem]" aria-hidden />
                  ) : (
                    <AddToPlan added={added} onAdd={() => handleAdd(task as SuggestedTask)} title={task.title} />
                  )
                }
              />
            );
          })}
        </div>
      )}

      <TaskDetailSheet
        task={selectedTask}
        systemId={selectedTask?.systemId ?? ''}
        open={selectedTask !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedTask(null);
        }}
        onComplete={(task) => handleToggle(task)}
      />
    </section>
  );
}
