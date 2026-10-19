'use client';

import { useCallback, useRef, useState } from 'react';
import { toast } from 'sonner';
import type { TaskStatus } from './tasks.state-machine';
import type { TaskTransport } from './tasks.types';

/** Lo que dura el Deshacer de una fila tachada. El mismo que el plan de Hoy. */
export const UNDO_MS = 4000;

/**
 * Tachar una fila, con el Deshacer de cuatro segundos. Es la conducta del plan
 * de Hoy (`TodayPlanCard`) puesta donde la puede usar cualquier lista: la fila
 * tachada se queda en su sitio hasta la siguiente visita, porque una lista que
 * recoloca sus renglones a los cuatro segundos mueve lo que la persona está
 * leyendo (y eso es CLS).
 *
 * El Deshacer reabre la tarea una sola vez, no alterna: la mutación es un
 * flip, así que alternar a ciegas un Deshacer tardío volvería a dejar la tarea
 * hecha. Reabrir la deja donde el servidor pone una tarea reabierta (Hoy, ver
 * `tasks.state-machine.ts`), no necesariamente donde estaba: una de la semana
 * o del backlog vuelve a Hoy. Si la persona deshace con el círculo, el aviso
 * se cierra en ese toque.
 *
 * `toggle` es la mutación (optimista: `useToggleTask` o `useToggleTodayTask`).
 * `onStrike` avisa cuándo se tachó, por si la lista quiere celebrarlo.
 */
export function useTachar(toggle: (taskId: string) => void, onStrike?: (task: TaskTransport) => void) {
  // Las completadas aquí y que siguen hechas según el último gesto, con el id
  // de su aviso: es la fuente del Deshacer, no depende de que el servidor ya
  // haya contestado.
  const completedHere = useRef(new Map<string, string | number | undefined>());
  const [struck, setStruck] = useState<ReadonlySet<string>>(() => new Set());

  const undo = useCallback(
    (taskId: string) => {
      if (!completedHere.current.has(taskId)) return;
      completedHere.current.delete(taskId);
      toggle(taskId);
    },
    [toggle],
  );

  const handleToggle = useCallback(
    (task: TaskTransport) => {
      if (task.status !== 'done' && !completedHere.current.has(task.id)) {
        setStruck((prev) => new Set(prev).add(task.id));
        toggle(task.id);
        const toastId = toast(`Hecha: ${task.title}`, {
          duration: UNDO_MS,
          action: { label: 'Deshacer', onClick: () => undo(task.id) },
        });
        completedHere.current.set(task.id, toastId);
        onStrike?.(task);
        return;
      }
      const toastId = completedHere.current.get(task.id);
      if (toastId !== undefined) toast.dismiss(toastId);
      if (completedHere.current.has(task.id)) undo(task.id);
      else toggle(task.id);
    },
    [toggle, undo, onStrike],
  );

  return { struck, handleToggle };
}

/**
 * Una lista que tacha sin moverse. Mientras nadie tacha, las filas son las de
 * la suscripción. Al primer tachón se congela el orden de lo que se ve: una
 * fila tachada sigue en su renglón aunque la suscripción ya no la traiga (lo
 * sugerido, por ejemplo, deja de sugerir una hecha), y lo nuevo entra al
 * final. El orden se suelta en la siguiente visita, cuando la lista se monta
 * de nuevo.
 */
export function useListaTachable(
  items: readonly TaskTransport[],
  toggle: (taskId: string) => void,
  onStrike?: (task: TaskTransport) => void,
) {
  const [quietas, setQuietas] = useState<readonly TaskTransport[] | null>(null);
  const { struck, handleToggle } = useTachar(toggle, (task) => {
    // Se llama en el toque, con las filas del último render ya pintado.
    setQuietas((prev) => prev ?? filas);
    onStrike?.(task);
  });

  let filas: readonly TaskTransport[] = items;
  if (quietas) {
    const vivas = new Map(items.map((t) => [t.id, t]));
    const vistas = new Set(quietas.map((t) => t.id));
    filas = [
      ...quietas.flatMap((t) => {
        const viva = vivas.get(t.id);
        if (viva) return [viva];
        // Ya no viene: sólo se queda si la tachó la persona en esta visita.
        return struck.has(t.id) ? [{ ...t, status: 'done' as const }] : [];
      }),
      ...items.filter((t) => !vistas.has(t.id)),
    ];
  }

  return { filas, struck, handleToggle };
}

/**
 * Tachar en las vistas de sistema, que filtran por estado (el Backlog enseña
 * `backlog`, Acción y Planificación esconden las hechas). Al completar, la
 * suscripción trae la tarea en `done` en el mismo toque (es optimista) y esas
 * listas la sacaban sin tachado ni Deshacer: la fila desaparecía y las de abajo
 * subían.
 *
 * `estadoDe` es el estado con el que la vista debe filtrar y agrupar: el de
 * antes de completar mientras la fila siga tachada en esta visita, y el real
 * en cuanto se deshace o en la siguiente visita. La fila se pinta con la tarea
 * real (hecha, con su círculo lleno) y `struck` dice cuál animar.
 */
export function useTacharEnSitio(toggle: (taskId: string) => void) {
  const [antes, setAntes] = useState<ReadonlyMap<string, TaskStatus>>(() => new Map());
  const { struck, handleToggle } = useTachar(toggle, (task) => {
    setAntes((prev) => new Map(prev).set(task.id, task.status as TaskStatus));
  });

  const estadoDe = useCallback(
    (task: TaskTransport): TaskStatus =>
      task.status === 'done' && struck.has(task.id) ? (antes.get(task.id) ?? (task.status as TaskStatus)) : (task.status as TaskStatus),
    [antes, struck],
  );

  return { struck, handleToggle, estadoDe };
}
