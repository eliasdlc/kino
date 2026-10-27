'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { EmptyState } from '@/components/ui/empty-state';
import { SectionHead } from '@/features/dashboard/SectionHead';
import { EnergyBudgetBar } from '@/features/energy/EnergyBudgetBar';
import { useEnergyBudget } from '@/features/energy/energy.hooks';
import { useUserSettings } from '@/features/settings/settings.hooks';
import { crossesLimitWith } from '@/features/energy/energy.budget';
import { useSuggestedTasks, useAddToTodayPlan, useToggleTodayTask, useTodayPlanTasks, type SuggestedTask } from './tasks.hooks';
import { getOverdueTasks } from './OverdueGroup';
import { TaskDetailSheet } from './TaskDetailSheet';
import { TaskRow } from './TaskRow';
import { conVisita, useListaTachable } from './useTachar';
import { LISTA_FILA_ALTO, ListaSkeleton, PresupuestoSkeleton } from './TasksSkeleton';
import type { TaskTransport } from './tasks.types';

/** Cuántas sugerencias se ven: siete caben en una pantalla de teléfono sin volverse otra lista. */
const VISIBLES = 7;

/**
 * Agregar al plan, en la cola de la fila: la palabra, no un glifo suelto, en
 * 48 px de alto. Ya en el plan dice "en el plan" en mute y deja de ser botón:
 * el --ok es de hecha, y un check verde junto a un círculo vacío decía a la
 * vez hecha y pendiente. Las dos ocupan el mismo ancho, para que el título no
 * se reparta en otras líneas al agregar.
 */
function AddToPlan({ added, onAdd, title }: { added: boolean; onAdd: () => void; title: string }) {
  const caja = '-mr-2 inline-flex min-h-[2.85rem] min-w-[5.6rem] items-center justify-end px-2 text-sm';
  if (added) {
    return (
      <span className={`${caja} text-muted-foreground`} aria-label={`${title} ya está en el plan`} role="img">
        en el plan
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={onAdd}
      aria-label={`Agregar ${title} al plan de hoy`}
      className={`${caja} press focus-ring rounded-full font-semibold text-foreground transition-[background-color,transform] duration-(--dur-toque) ease-(--ease-pluma) hover:bg-sf2/60`}
    >
      Al plan
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
 *
 * Una vencida no se sugiere aquí: tiene su sección justo debajo, y en las dos
 * a la vez se tachaba en una y saltaba en la otra. Mientras el presupuesto
 * no se sabe, su renglón guarda el sitio a su altura real.
 */
export const KinoSuggestedSection = conVisita(function KinoSuggestedSection() {
  const { data: sugeridas = [], isLoading } = useSuggestedTasks();
  const { isLoading: ajustesCargando } = useUserSettings();
  const { isLoading: planCargando } = useTodayPlanTasks();
  const { mutate: addToPlan } = useAddToTodayPlan();
  const { mutate: complete } = useToggleTodayTask();
  const budget = useEnergyBudget();

  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [selectedTask, setSelectedTask] = useState<TaskTransport | null>(null);

  const vencidas = new Set(getOverdueTasks(sugeridas as TaskTransport[]).map((t) => t.id));
  const suggestions = sugeridas.filter((t) => !vencidas.has(t.id));
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

      {ajustesCargando || planCargando ? <PresupuestoSkeleton /> : <EnergyBudgetBar className="py-3 pl-(--margen)" />}

      {isLoading ? (
        <ListaSkeleton filas={3} />
      ) : filas.length === 0 ? (
        <EmptyState
          className="pl-(--margen)"
          title={
            suggestions.length > 0 ? 'Todo lo sugerido está en el plan' : vencidas.size > 0 ? 'Lo urgente está en Vencidas' : 'Nada que sugerir'
          }
          description={
            suggestions.length > 0
              ? 'Lo que sigue lo eliges tú, desde la lista de abajo.'
              : vencidas.size > 0
                ? 'Empieza por ahí: está justo debajo.'
                : 'No quedan tareas abiertas. El resto del día es tuyo.'
          }
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
                    <span className="-mr-2 block min-h-[2.85rem] min-w-[5.6rem]" aria-hidden />
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
});
