'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { toast } from 'sonner';
import { useUpdateTask } from './tasks.hooks';
import type { TaskStatus } from './tasks.state-machine';
import type { TaskTransport } from './tasks.types';

/** Lo que dura el Deshacer de una fila tachada. El mismo que el plan de Hoy. */
export const UNDO_MS = 4000;

/** Un gesto de completar. Deshacer lo apaga una sola vez, aunque se pulse tarde. */
interface Gesto {
  vigente: boolean;
  aviso?: string | number;
}

/** Una fila tachada en esta visita: el estado que tenía y el gesto que la tachó. */
interface Tachada {
  antes: TaskStatus;
  gesto: Gesto;
}

/** Con qué se completa (un flip) y con qué se devuelve la tarea a su estado. */
interface Acciones {
  toggle: (taskId: string) => void;
  restaurar: (taskId: string, status: TaskStatus) => void;
}

/**
 * Las filas tachadas de la visita, compartidas por todo lo que se pinta a la
 * vez: la hoja de detalle tacha una fila que otra lista ya pintó, y las dos
 * tienen que verla tachada en su sitio. La visita termina cuando se desmonta
 * lo último que mira esto: la siguiente empieza limpia.
 */
let tachadas: ReadonlyMap<string, Tachada> = new Map();
const oyentes = new Set<() => void>();
const alTachar = new Set<(task: TaskTransport) => void>();

function publicar(siguiente: ReadonlyMap<string, Tachada>) {
  tachadas = siguiente;
  for (const oyente of [...oyentes]) oyente();
}

function suscribir(oyente: () => void) {
  if (oyentes.size === 0) tachadas = new Map();
  oyentes.add(oyente);
  return () => {
    oyentes.delete(oyente);
    if (oyentes.size === 0) tachadas = new Map();
  };
}

const instantanea = () => tachadas;

/** Las filas tachadas en esta visita, con el estado que tenían antes. */
function useTachadas() {
  return useSyncExternalStore(suscribir, instantanea, instantanea);
}

/**
 * Deshacer reabre la tarea una sola vez: la devuelve al estado que tenía
 * antes de tacharla (una de la semana vuelve a la semana, no a Hoy) y no
 * alterna, porque alternar a ciegas un Deshacer tardío la dejaría hecha.
 */
function deshacer(taskId: string, antes: TaskStatus, gesto: Gesto, acciones: Acciones) {
  if (!gesto.vigente) return;
  gesto.vigente = false;
  acciones.restaurar(taskId, antes);
}

/**
 * Tacha una fila, con el Deshacer de cuatro segundos, o la reabre si el gesto
 * que la tachó sigue vigente (el círculo de una fila tachada). Una tarea que
 * ya venía hecha se alterna con `toggle`, que la deja donde el servidor pone
 * una reabierta (Hoy).
 */
export function tacharTarea(task: TaskTransport, acciones: Acciones) {
  const previa = tachadas.get(task.id);
  if (task.status === 'done' || previa?.gesto.vigente) {
    if (previa?.gesto.vigente) {
      if (previa.gesto.aviso !== undefined) toast.dismiss(previa.gesto.aviso);
      deshacer(task.id, previa.antes, previa.gesto, acciones);
    } else {
      acciones.toggle(task.id);
    }
    return;
  }
  const antes = task.status as TaskStatus;
  const gesto: Gesto = { vigente: true };
  publicar(new Map(tachadas).set(task.id, { antes, gesto }));
  for (const oyente of [...alTachar]) oyente(task);
  acciones.toggle(task.id);
  gesto.aviso = toast(`Hecha: ${task.title}`, {
    duration: UNDO_MS,
    action: { label: 'Deshacer', onClick: () => deshacer(task.id, antes, gesto, acciones) },
  });
}

/**
 * Tachar una fila, con el Deshacer de cuatro segundos. Es la conducta del plan
 * de Hoy (`TodayPlanCard`) puesta donde la puede usar cualquier lista: la fila
 * tachada se queda en su sitio hasta la siguiente visita, porque una lista que
 * recoloca sus renglones a los cuatro segundos mueve lo que la persona está
 * leyendo (y eso es CLS).
 *
 * `toggle` es la mutación (optimista: `useToggleTask` o `useToggleTodayTask`).
 * Si la persona deshace con el círculo, el aviso se cierra en ese toque.
 */
export function useTachar(toggle: (taskId: string) => void) {
  const { mutate: actualizar } = useUpdateTask('');
  const filas = useTachadas();
  const struck = useMemo<ReadonlySet<string>>(() => new Set(filas.keys()), [filas]);

  const handleToggle = useCallback(
    (task: TaskTransport) =>
      tacharTarea(task, { toggle, restaurar: (taskId, status) => actualizar({ taskId, data: { status } }) }),
    [toggle, actualizar],
  );

  return { struck, handleToggle, tachadas: filas };
}

/**
 * Una lista que tacha sin moverse. Mientras nadie tacha, las filas son las de
 * la suscripción. Al primer tachón se congela el orden de lo que se ve: una
 * fila tachada sigue en su renglón aunque la suscripción ya no la traiga (lo
 * sugerido, por ejemplo, deja de sugerir una hecha), y lo nuevo entra al
 * final. El orden se suelta en la siguiente visita, cuando la lista se monta
 * de nuevo.
 */
export function useListaTachable(items: readonly TaskTransport[], toggle: (taskId: string) => void) {
  const [quietas, setQuietas] = useState<readonly TaskTransport[] | null>(null);
  const { struck, handleToggle, tachadas: filasTachadas } = useTachar(toggle);

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

  // Quien tacha (el círculo de una fila o la hoja de detalle) avisa en el
  // toque, con las filas del último render ya pintado: ahí se congela el orden.
  const pintadas = useRef(filas);
  useLayoutEffect(() => {
    pintadas.current = filas;
  });
  useEffect(() => {
    const congelar = () => setQuietas((prev) => prev ?? pintadas.current);
    alTachar.add(congelar);
    return () => {
      alTachar.delete(congelar);
    };
  }, []);

  return { filas, struck, handleToggle, estadoDe: estadoDeCon(filasTachadas) };
}

/**
 * El estado con el que una vista debe filtrar y agrupar una tarea: el de antes
 * de completar mientras la fila siga tachada en esta visita, y el real en
 * cuanto se deshace o en la siguiente visita.
 */
function estadoDeCon(filas: ReadonlyMap<string, Tachada>) {
  return (task: TaskTransport): TaskStatus => {
    const tachada = filas.get(task.id);
    return task.status === 'done' && tachada ? tachada.antes : (task.status as TaskStatus);
  };
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
  const { struck, handleToggle, tachadas: filas } = useTachar(toggle);
  const estadoDe = useMemo(() => estadoDeCon(filas), [filas]);
  return { struck, handleToggle, estadoDe };
}
