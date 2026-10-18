'use client';

import { useCallback, useRef, useState } from 'react';
import { toast } from 'sonner';
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
 * El Deshacer devuelve el estado de antes de completar, no alterna: la
 * mutación es un flip, así que alternar a ciegas un Deshacer tardío volvería a
 * dejar la tarea hecha. Si la persona deshace con el círculo, el aviso se
 * cierra en ese toque.
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
