'use client';

import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ComponentType,
  type ReactNode,
} from 'react';
import { toast } from 'sonner';
import { useToggleTask, useUpdateTask } from './tasks.hooks';
import type { TaskStatus } from './tasks.state-machine';
import type { TaskTransport } from './tasks.types';

/** Lo que dura el Deshacer de una fila tachada. El mismo que el plan de Hoy. */
export const UNDO_MS = 4000;

/** Dónde estaba la tarea antes de tacharla: ahí la devuelve Deshacer. */
interface Antes {
  status: TaskStatus;
  inTodayPlan: boolean;
}

/** Un gesto de completar. Su identidad es lo que hace que Deshacer valga una sola vez. */
interface Gesto {
  aviso?: string | number;
}

/**
 * Una fila tachada en esta visita. Mientras Deshacer viaja (reabrir y, si hace
 * falta, escribir el estado guardado) la fila ya no se tacha, pero las vistas
 * la siguen filtrando con su estado de antes, para que no salga y vuelva a
 * entrar entre las dos escrituras.
 */
interface Tachada {
  antes: Antes;
  gesto: Gesto;
  fase: 'tachada' | 'deshaciendo';
}

type Tachadas = ReadonlyMap<string, Tachada>;

/**
 * Las filas tachadas de una visita a una página, y las listas que quieren
 * saber cuándo se tacha una para quedarse quietas.
 */
function crearVisita() {
  let filas: Tachadas = new Map();
  const oyentes = new Set<() => void>();
  const alTachar = new Set<(taskId: string) => void>();

  const escribir = (cambio: (siguiente: Map<string, Tachada>) => void) => {
    const siguiente = new Map(filas);
    cambio(siguiente);
    filas = siguiente;
    for (const oyente of [...oyentes]) oyente();
  };
  /** Cambia la fase de la fila sólo si sigue siendo la del mismo gesto. */
  const pasar = (taskId: string, gesto: Gesto, de: Tachada['fase'], a: Tachada['fase']) => {
    const fila = filas.get(taskId);
    if (fila?.gesto !== gesto || fila.fase !== de) return false;
    escribir((m) => m.set(taskId, { ...fila, fase: a }));
    return true;
  };

  return {
    filas: () => filas,
    suscribir(oyente: () => void) {
      oyentes.add(oyente);
      return () => void oyentes.delete(oyente);
    },
    alTachar(oyente: (taskId: string) => void) {
      alTachar.add(oyente);
      return () => void alTachar.delete(oyente);
    },
    tachar(taskId: string, antes: Antes, gesto: Gesto) {
      escribir((m) => m.set(taskId, { antes, gesto, fase: 'tachada' }));
      for (const oyente of [...alTachar]) oyente(taskId);
    },
    /** Empieza a deshacer un gesto. `false` si ese gesto ya no está vigente. */
    deshacer: (taskId: string, gesto: Gesto) => pasar(taskId, gesto, 'tachada', 'deshaciendo'),
    /** No se pudo reabrir: la fila sigue tachada y su círculo vuelve a ofrecer deshacer. */
    retachar: (taskId: string, gesto: Gesto) => void pasar(taskId, gesto, 'deshaciendo', 'tachada'),
    /** Deshacer terminó: la fila vuelve a ser la de la suscripción. */
    soltar(taskId: string, gesto: Gesto) {
      if (filas.get(taskId)?.gesto === gesto) escribir((m) => m.delete(taskId));
    },
  };
}

type Visita = ReturnType<typeof crearVisita>;

const VisitaContext = createContext<Visita | null>(null);

/**
 * La visita a una página: lo que se tacha dentro, desde una fila o desde la
 * hoja de detalle, se ve tachado en su sitio en las listas de la página que lo
 * enseñan. Nace limpia cada vez que la página se monta. Uno anidado se une a
 * la visita de fuera, así que una sección que se monta sola (en un test o en
 * el catálogo) tiene la suya, y en su página comparte la de la página.
 */
export function TacharProvider({ children }: { children: ReactNode }) {
  const deFuera = useContext(VisitaContext);
  const [propia] = useState(crearVisita);
  return deFuera ? children : createElement(VisitaContext.Provider, { value: propia }, children);
}

/** Monta un componente dentro de su visita: la de su página, o una propia si se monta solo. */
export function conVisita<P extends object>(Componente: ComponentType<P>) {
  return function ConVisita(props: P) {
    return createElement(TacharProvider, null, createElement(Componente, props));
  };
}

/** La visita de la página, o una de este componente si no hay ninguna encima. */
function useVisita(): Visita {
  const deFuera = useContext(VisitaContext);
  const [propia] = useState(crearVisita);
  return deFuera ?? propia;
}

/**
 * Tacha una fila, con el Deshacer de cuatro segundos, o la reabre si el gesto
 * que la tachó sigue vigente (el círculo de una fila tachada). Una tarea que
 * ya venía hecha se alterna con `toggle`, que la deja donde el servidor pone
 * una reabierta (Hoy).
 */
function tacharTarea(
  task: TaskTransport,
  visita: Visita,
  acciones: { toggle: (taskId: string) => void; deshacer: (taskId: string, gesto: Gesto) => void },
) {
  const previa = visita.filas().get(task.id);
  if (previa?.fase === 'tachada') {
    if (previa.gesto.aviso !== undefined) toast.dismiss(previa.gesto.aviso);
    acciones.deshacer(task.id, previa.gesto);
    return;
  }
  if (task.status === 'done') {
    acciones.toggle(task.id);
    return;
  }
  // Tachada otra vez mientras su Deshacer viaja: su sitio sigue siendo el de antes.
  const antes = previa?.antes ?? { status: task.status as TaskStatus, inTodayPlan: task.inTodayPlan };
  const gesto: Gesto = {};
  visita.tachar(task.id, antes, gesto);
  acciones.toggle(task.id);
  gesto.aviso = toast(`Hecha: ${task.title}`, {
    duration: UNDO_MS,
    action: { label: 'Deshacer', onClick: () => acciones.deshacer(task.id, gesto) },
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
  const visita = useVisita();
  const tachadas = useSyncExternalStore(visita.suscribir, visita.filas, visita.filas);
  const struck = useMemo<ReadonlySet<string>>(
    () => new Set([...tachadas].filter(([, fila]) => fila.fase === 'tachada').map(([id]) => id)),
    [tachadas],
  );
  const { mutateAsync: actualizar } = useUpdateTask('');
  const { mutateAsync: reabrir } = useToggleTask('');

  // Deshacer reabre una sola vez y devuelve la tarea a donde estaba: no
  // alterna a ciegas, porque un Deshacer tardío la dejaría hecha. Reabrir pasa
  // por `toggle` porque es el camino del servidor que limpia `completedAt`
  // (`update` sólo escribe el estado), y reabre en Hoy dentro del plan; si la
  // tarea venía de otro sitio (otro estado, o fuera del plan de hoy), éste se
  // escribe después. Un fallo al reabrir ya lo avisa `useToggleTask`.
  const deshacer = useCallback(
    (taskId: string, gesto: Gesto) => {
      if (!visita.deshacer(taskId, gesto)) return;
      const { antes } = visita.filas().get(taskId)!;
      void reabrir(taskId).then(
        async (reabierta) => {
          // Tachada otra vez mientras viajaba: manda el gesto nuevo.
          if (visita.filas().get(taskId)?.gesto !== gesto) return;
          const enSuSitio = reabierta.status === antes.status && (reabierta.status === 'today') === antes.inTodayPlan;
          if (!enSuSitio) {
            await actualizar({ taskId, data: { status: antes.status, inTodayPlan: antes.inTodayPlan } }).catch(() => {
              toast.error('La tarea se reabrió, pero no volvió a su lista');
            });
          }
          visita.soltar(taskId, gesto);
        },
        () => visita.retachar(taskId, gesto),
      );
    },
    [visita, reabrir, actualizar],
  );

  const handleToggle = useCallback(
    (task: TaskTransport) => tacharTarea(task, visita, { toggle, deshacer }),
    [visita, toggle, deshacer],
  );

  return { struck, handleToggle, tachadas, visita };
}

/**
 * Una lista que tacha sin moverse. Mientras nadie tacha una de sus filas, las
 * filas son las de la suscripción. Cuando se tacha una que esta lista enseña
 * (desde la fila o desde la hoja), se congela el orden de lo que se ve: la
 * fila tachada sigue en su renglón aunque la suscripción ya no la traiga (lo
 * sugerido, por ejemplo, deja de sugerir una hecha), y lo nuevo entra al
 * final. Tachar en otra lista no la congela. El orden se suelta en la
 * siguiente visita, cuando la lista se monta de nuevo.
 */
export function useListaTachable(items: readonly TaskTransport[], toggle: (taskId: string) => void) {
  const [quietas, setQuietas] = useState<readonly TaskTransport[] | null>(null);
  const { struck, handleToggle, tachadas, visita } = useTachar(toggle);

  const filas = useMemo<readonly TaskTransport[]>(() => {
    if (!quietas) return items;
    const vivas = new Map(items.map((t) => [t.id, t]));
    const vistas = new Set(quietas.map((t) => t.id));
    return [
      ...quietas.flatMap((t) => {
        const viva = vivas.get(t.id);
        if (viva) return [viva];
        // Ya no viene: sólo se queda si la tachó la persona en esta visita.
        const tachada = tachadas.get(t.id);
        if (!tachada) return [];
        return [{ ...t, status: tachada.fase === 'tachada' ? ('done' as const) : tachada.antes.status }];
      }),
      ...items.filter((t) => !vistas.has(t.id)),
    ];
  }, [items, quietas, tachadas]);

  // Quien tacha (el círculo de una fila o la hoja de detalle) avisa en el
  // toque, con las filas del último render ya pintado: ahí se congela el orden,
  // si la tachada es una de las suyas.
  const pintadas = useRef(filas);
  useLayoutEffect(() => {
    pintadas.current = filas;
  });
  useEffect(
    () =>
      visita.alTachar((taskId) => {
        if (pintadas.current.some((t) => t.id === taskId)) setQuietas((prev) => prev ?? pintadas.current);
      }),
    [visita],
  );

  return { filas, struck, handleToggle, estadoDe: estadoDeCon(tachadas) };
}

/**
 * El estado con el que una vista debe filtrar y agrupar una tarea: el de antes
 * de completar mientras la fila siga tachada en esta visita o su Deshacer
 * viaje, y el real en cuanto Deshacer termina o en la siguiente visita.
 */
function estadoDeCon(tachadas: Tachadas) {
  return (task: TaskTransport): TaskStatus => {
    const fila = tachadas.get(task.id);
    if (fila && (task.status === 'done' || fila.fase === 'deshaciendo')) return fila.antes.status;
    return task.status as TaskStatus;
  };
}

/**
 * Tachar en las vistas de sistema, que filtran por estado (el Backlog enseña
 * `backlog`, Acción y Planificación esconden las hechas). Al completar, la
 * suscripción trae la tarea en `done` en el mismo toque (es optimista) y esas
 * listas la sacaban sin tachado ni Deshacer: la fila desaparecía y las de abajo
 * subían.
 *
 * `estadoDe` es el estado con el que la vista debe filtrar y agrupar (ver
 * `estadoDeCon`). La fila se pinta con la tarea real (hecha, con su círculo
 * lleno) y `struck` dice cuál animar.
 */
export function useTacharEnSitio(toggle: (taskId: string) => void) {
  const { struck, handleToggle, tachadas } = useTachar(toggle);
  const estadoDe = useMemo(() => estadoDeCon(tachadas), [tachadas]);
  return { struck, handleToggle, estadoDe };
}
