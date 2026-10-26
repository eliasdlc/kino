'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, GitBranch, Link2, Mic } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { MarginRow } from '@/components/ui/margin-row';
import { cn } from '@/lib/utils';
import { CascadeInboxMode } from '@/features/tasks/CascadeInboxMode';
import { TaskDetailSheet } from '@/features/tasks/TaskDetailSheet';
import { useQuickAddStore } from '@/features/tasks/quick-add.store';
import { useTasks, useToggleTask } from '@/features/tasks/tasks.hooks';
import type { TaskTransport } from '@/features/tasks/tasks.types';
import { GroupNudge } from '@/features/systems/GroupNudge';
import { CaptureRow } from '@/features/captures/CaptureRow';
import { FALLO_AL_CONFIRMAR, ShareConfirm, type DestinoConfirmado } from '@/features/captures/ShareConfirm';
import {
  useCaptures,
  useConfirmCapture,
  useDiscardCapture,
} from '@/features/captures/captures.hooks';
import type { CaptureItem } from '@/features/captures/captures.types';
import type { SystemViewProps } from './SystemDetailView';

/**
 * Cuántos items se pintan de una vez. Por encima, la lista deja de ser algo que
 * se lee y pasa a ser algo que se desplaza, y la fila del resto dice cuántos
 * quedan en vez de fingir que no están.
 */
export const ITEMS_VISIBLES = 50;

/** Lo que dura el Deshacer de una fila tachada, el mismo de Hoy. */
export const DESHACER_MS = 4000;

/**
 * Glifo por fuente conocida, con su nombre en palabras. Una fuente que no
 * conoce no se dibuja. El hueco de la derecha de cada fila lo comparten las
 * tareas y las capturas, que es lo que permite que las dos vivan en la misma
 * lista sin cambiar de forma.
 */
const SOURCE_GLYPHS: Record<string, { Icono: typeof Link2; nombre: string }> = {
  github: { Icono: GitBranch, nombre: 'GitHub' },
  link: { Icono: Link2, nombre: 'enlace' },
  voice: { Icono: Mic, nombre: 'nota de voz' },
};

/**
 * "3 tareas creadas: 2 en Tesis, 1 en Bandeja", o "1 tarea creada en Tesis":
 * lo que cierra el ciclo de capturar y confirmar, con a dónde fue cada una.
 */
export function avisoDeConfirmadas(destinos: DestinoConfirmado[]): string {
  const total = destinos.reduce((suma, d) => suma + d.cuenta, 0);
  const cabeza = total === 1 ? '1 tarea creada' : `${total} tareas creadas`;
  if (destinos.length === 1) return `${cabeza} en ${destinos[0]!.nombre}`;
  return `${cabeza}: ${destinos.map((d) => `${d.cuenta} en ${d.nombre}`).join(', ')}`;
}

interface InboxViewProps extends SystemViewProps {
  /**
   * Las capturas que el servidor ya leyó. Sin ellas la lista se pintaba vacía
   * y las capturas entraban después, empujando las tareas hacia abajo; con
   * ellas llega entera en el primer pintado.
   */
  initialCaptures?: CaptureItem[];
  /** El nivel del título: el catálogo lo baja a h2 para no meter un h1 de más. */
  tituloComo?: 'h1' | 'h2';
}

/**
 * Bandeja: el embudo de triaje. No tiene carpetas a propósito, así que tampoco
 * tiene el funnel de cuatro tabs de los demás sistemas: lo único que se hace
 * aquí es mirar lo que entró y repartirlo.
 *
 * Es una página de Diario: el título en la columna de texto, una sola lista de
 * filas de margen (las capturas con su glifo y su estado en palabras, las
 * tareas con el círculo de completar de 48 px) y el vacío dicho con
 * `EmptyState`. Completar una tarea la tacha en su sitio y ofrece Deshacer 4 s;
 * la fila tachada no se va hasta la próxima visita, para que la lista no salte.
 *
 * Descartar una captura es la única acción que borra algo que puede no tener
 * copia (una foto, una nota de voz), así que tampoco es inmediata: la fila se
 * va, el aviso ofrece Deshacer 4 s y la mutación sale al terminar ese tiempo,
 * o al salir de Bandeja; si el servidor no la descarta, la fila vuelve y un aviso lo dice. Confirmar dice cuántas tareas creó y dónde, y si no
 * salió lo dice en la hoja, que sigue abierta.
 *
 * Aquí vive el primero de los dos empujes del principio 7. Es una fila de
 * estado sin pregunta, así que no pasa por la cola de una sola interrupción ni
 * gasta la apertura del día (D-18).
 */
export function InboxView({ system, initialTasks, initialCaptures, tituloComo = 'h1' }: InboxViewProps) {
  const router = useRouter();
  const tituloId = useId();
  const { data: tasks = [] } = useTasks(system.id, initialTasks);
  const { mutate: toggle } = useToggleTask(system.id);
  const { data: capturas = [] } = useCaptures(initialCaptures);
  const { mutate: confirmar, isPending: enviando } = useConfirmCapture();
  const { mutate: descartar } = useDiscardCapture();
  const abrirCaptura = useQuickAddStore((s) => s.setOpen);
  const [triaging, setTriaging] = useState(false);
  const [open, setOpen] = useState<TaskTransport | null>(null);
  const [confirmando, setConfirmando] = useState<CaptureItem | null>(null);
  // La captura cuyo confirmar falló: su hoja sigue abierta y lo dice. Va por id
  // para que abrir otra no herede el error de la anterior.
  const [fallo, setFallo] = useState<string | null>(null);
  const hojaAbierta = useRef<string | null>(null);
  useEffect(() => {
    hojaAbierta.current = confirmando?.id ?? null;
  }, [confirmando]);
  // Las tachadas en esta visita: siguen en su fila aunque el servidor ya las
  // cuente como hechas, y el Deshacer sólo devuelve lo que se tachó aquí.
  const [tachadas, setTachadas] = useState<ReadonlySet<string>>(() => new Set());
  const avisos = useRef(new Map<string, string | number>());
  // Las capturas descartadas que todavía se pueden deshacer: fuera de la
  // lista ya, con su mutación esperando en un temporizador.
  const [descartando, setDescartando] = useState<ReadonlySet<string>>(() => new Set());
  const porDescartar = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  // Salir de Bandeja no deshace: lo que se descartó y no se deshizo, se descarta.
  useEffect(() => {
    const pendientes = porDescartar.current;
    return () => {
      for (const [id, temporizador] of pendientes) {
        clearTimeout(temporizador);
        descartar(id);
      }
      pendientes.clear();
    };
  }, [descartar]);

  const pending = tasks.filter((task) => task.status !== 'done');
  const enLista = tasks.filter((task) => task.status !== 'done' || tachadas.has(task.id));
  const visibles = capturas.filter((captura) => !descartando.has(captura.id));
  const sinConfirmar = visibles.filter((captura) => captura.status === 'pending');
  const visible = enLista.slice(0, ITEMS_VISIBLES);
  const rest = enLista.length - visible.length;
  // La línea bajo el título existe siempre que haya algo, para que el
  // esqueleto la reserve y las filas no bajen al llegar. Con capturas dice
  // cuántas esperan y qué se hace con ellas; con un solo item, para qué sirve
  // el sitio (una lista con una cosa flotando es el estado que casi todos ven
  // el primer día).
  const resumen = sinConfirmar.length > 0;
  const linea = resumen
    ? sinConfirmar.length === 1
      ? '1 captura por revisar: tócala.'
      : `${sinConfirmar.length} capturas por revisar: toca una.`
    : pending.length === 1
      ? 'Una cosa esperando. Ábrela para mandarla a un sistema, o déjala ahí.'
      : pending.length > 1
        ? 'Ábrelas para mandarlas a un sistema, o déjalas ahí.'
        : null;

  function deshacer(task: TaskTransport) {
    if (!avisos.current.has(task.id)) return;
    avisos.current.delete(task.id);
    setTachadas((prev) => {
      const next = new Set(prev);
      next.delete(task.id);
      return next;
    });
    toggle(task.id);
  }

  function completar(task: TaskTransport) {
    if (avisos.current.has(task.id)) {
      // El círculo de una tachada la devuelve: su aviso ya no tiene qué deshacer.
      toast.dismiss(avisos.current.get(task.id));
      deshacer(task);
      return;
    }
    setTachadas((prev) => new Set(prev).add(task.id));
    toggle(task.id);
    const aviso = toast(`Hecha: ${task.title}`, {
      duration: DESHACER_MS,
      action: { label: 'Deshacer', onClick: () => deshacer(task) },
    });
    avisos.current.set(task.id, aviso);
  }

  function devolverCaptura(id: string) {
    const temporizador = porDescartar.current.get(id);
    if (temporizador === undefined) return;
    clearTimeout(temporizador);
    porDescartar.current.delete(id);
    setDescartando((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  function descartarCaptura(captura: CaptureItem) {
    setDescartando((prev) => new Set(prev).add(captura.id));
    porDescartar.current.set(
      captura.id,
      setTimeout(() => {
        porDescartar.current.delete(captura.id);
        descartar(captura.id, {
          // La captura sigue en el servidor: vuelve a la lista y lo dice.
          onError: () => {
            setDescartando((prev) => {
              const next = new Set(prev);
              next.delete(captura.id);
              return next;
            });
            toast.error('No se pudo descartar la captura. Sigue en la lista: inténtalo de nuevo.');
          },
        });
      }, DESHACER_MS),
    );
    toast('Captura descartada', {
      duration: DESHACER_MS,
      action: { label: 'Deshacer', onClick: () => devolverCaptura(captura.id) },
    });
  }

  /**
   * La hoja no se cierra al tocar Confirmar sino al saber que salió: si la
   * mutación falla, la hoja sigue abierta con sus marcas y dice que no se creó
   * nada. Si ya se había cerrado, lo dice un aviso.
   */
  function confirmarCaptura(captura: CaptureItem, indices: number[], destinos: DestinoConfirmado[]) {
    setFallo(null);
    confirmar(
      { id: captura.id, indices },
      {
        onSuccess: () => {
          if (hojaAbierta.current === captura.id) setConfirmando(null);
          const fuera = destinos.length === 1 && destinos[0]!.systemId !== null ? destinos[0]! : null;
          toast(avisoDeConfirmadas(destinos), {
            action: fuera ? { label: `Abrir ${fuera.nombre}`, onClick: () => router.push(`/systems/${fuera.systemId}`) } : undefined,
          });
        },
        onError: () => {
          if (hojaAbierta.current === captura.id) setFallo(captura.id);
          else toast(`${FALLO_AL_CONFIRMAR.estado} ${FALLO_AL_CONFIRMAR.detalle}`);
        },
      },
    );
  }

  return (
    <section aria-labelledby={tituloId} className="space-y-4">
      <Header id={tituloId} Titular={tituloComo} count={pending.length + visibles.length} linea={linea} />

      {enLista.length === 0 && visibles.length === 0 ? (
        <EmptyState
          className="pl-(--margen)"
          title="Nada por repartir"
          description="Bandeja está vacía. Lo que captures sin decidir dónde va aterriza aquí."
          action={
            <Button variant="secondary" onClick={() => abrirCaptura(true)}>
              Capturar algo
            </Button>
          }
        />
      ) : (
        <div>
          <GroupNudge count={pending.length} onTriage={() => setTriaging(true)} />

          <ul className="[&>li:last-child>*]:border-b-0">
            {visibles.map((captura) => (
              <CaptureRow key={captura.id} captura={captura} onOpen={setConfirmando} />
            ))}
            {visible.map((task) => (
              <InboxTaskRow
                key={task.id}
                task={task}
                tachada={tachadas.has(task.id)}
                onComplete={() => completar(task)}
                onOpen={() => setOpen(task)}
              />
            ))}
          </ul>

          {rest > 0 && (
            <p className="pt-3 pl-(--margen) text-sm text-muted-foreground">
              Quedan {rest} más sin pintar. Repártelas y la lista baja.
            </p>
          )}
        </div>
      )}

      <ShareConfirm
        captura={confirmando}
        open={confirmando !== null}
        onOpenChange={(next) => {
          if (next) return;
          setConfirmando(null);
          setFallo(null);
        }}
        enviando={enviando}
        fallo={fallo !== null && fallo === confirmando?.id}
        onConfirm={(indices, destinos) => {
          if (confirmando) confirmarCaptura(confirmando, indices, destinos);
        }}
        onDiscard={() => {
          if (confirmando) descartarCaptura(confirmando);
          setConfirmando(null);
        }}
      />

      <CascadeInboxMode tasks={pending} open={triaging} onOpenChange={setTriaging} />
      <TaskDetailSheet
        task={open}
        systemId={system.id}
        open={open !== null}
        onOpenChange={(next) => !next && setOpen(null)}
      />
    </section>
  );
}

/**
 * Una tarea de Bandeja: el círculo de completar de 48 px en el margen, el
 * título como botón que abre el detalle y el glifo de la fuente a la derecha.
 * Tachada, el círculo se rellena con --ok y el título cae a mute.
 */
function InboxTaskRow({
  task,
  tachada,
  onComplete,
  onOpen,
}: {
  task: TaskTransport;
  tachada: boolean;
  onComplete: () => void;
  onOpen: () => void;
}) {
  const fuente = task.externalSource ? SOURCE_GLYPHS[task.externalSource] : undefined;
  return (
    <li>
      <MarginRow
        className="group last:border-b"
        margin={
          <button
            type="button"
            onClick={onComplete}
            aria-label={`Completar ${task.title}`}
            aria-pressed={tachada}
            className="press focus-ring -mt-[0.15rem] flex size-[2.85rem] items-center justify-center rounded-full transition-transform duration-(--dur-toque) ease-(--ease-pluma)"
          >
            <span
              aria-hidden
              className={cn(
                'flex size-[1.35rem] items-center justify-center rounded-full border-[1.6px] transition-[background-color,border-color,transform] duration-(--dur-tachar) ease-(--ease-pluma)',
                tachada ? 'anim-tachar border-task-done bg-task-done text-task-done-foreground' : 'border-input group-hover:border-foreground/60',
              )}
            >
              {tachada && <Check className="size-3" strokeWidth={3} />}
            </span>
          </button>
        }
        trailing={
          // El hueco de la fuente, reservado aunque hoy casi nada lo use.
          <span className="grid size-6 place-items-center text-muted-foreground">
            {fuente && <fuente.Icono className="size-4 stroke-2" aria-label={fuente.nombre} />}
          </span>
        }
      >
        <button
          type="button"
          onClick={onOpen}
          className="focus-ring -my-2 block min-h-[2.85rem] w-full rounded-md py-2 text-left"
        >
          <span
            className={cn(
              'line-clamp-2 font-medium leading-snug transition-colors duration-(--dur-tachar) ease-(--ease-pluma)',
              tachada ? 'text-muted-foreground line-through' : 'text-foreground',
            )}
          >
            {task.title}
          </span>
        </button>
      </MarginRow>
    </li>
  );
}

/**
 * El título de Bandeja con la rejilla de una fila: el h1 en la columna de
 * texto, a la derecha del margen, también en escritorio, porque las filas de
 * abajo llevan su glifo en el margen y el título se alinea con su texto (en
 * `PageHeader` el margen se pliega en escritorio, y aquí no puede). La cuenta
 * a la derecha, en mute y tabular, con su palabra para el lector de pantalla;
 * debajo, la línea que dice qué espera.
 */
function Header({
  id,
  Titular,
  count,
  linea,
}: {
  id: string;
  Titular: 'h1' | 'h2';
  count: number;
  linea: string | null;
}) {
  return (
    <div className="grid grid-cols-[var(--margen)_1fr_auto] items-baseline">
      <span aria-hidden />
      <div className="min-w-0 space-y-1">
        <Titular id={id} className="font-display text-[1.41rem] font-bold tracking-[-0.02em]">
          Bandeja
        </Titular>
        {linea && <p className="text-sm text-muted-foreground">{linea}</p>}
      </div>
      <span className="font-display text-lg font-bold text-muted-foreground tabular-nums">
        <span aria-hidden>{count}</span>
        <span className="sr-only">{count} por repartir</span>
      </span>
    </div>
  );
}
