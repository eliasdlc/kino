'use client';

import { useRef, useState } from 'react';
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
import { ShareConfirm } from '@/features/captures/ShareConfirm';
import { resumenSinConfirmar } from '@/features/captures/captures.copy';
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

interface InboxViewProps extends SystemViewProps {
  /**
   * Las capturas que el servidor ya leyó. Sin ellas la lista se pintaba vacía
   * y las capturas entraban después, empujando las tareas hacia abajo; con
   * ellas llega entera en el primer pintado.
   */
  initialCaptures?: CaptureItem[];
}

/**
 * Bandeja: el embudo de triaje. No tiene carpetas a propósito, así que tampoco
 * tiene el funnel de cuatro tabs de los demás sistemas: lo único que se hace
 * aquí es mirar lo que entró y repartirlo.
 *
 * Es una página de Diario: el título en la columna de texto, una sola lista de
 * filas de margen (las capturas con su glifo y su barra de acento, las tareas
 * con el círculo de completar de 48 px) y el vacío dicho con `EmptyState`.
 * Completar una tarea la tacha en su sitio y ofrece Deshacer 4 s; la fila
 * tachada no se va hasta la próxima visita, para que la lista no salte.
 *
 * Aquí vive el primero de los dos empujes del principio 7. Es una fila de
 * estado sin pregunta, así que no pasa por la cola de una sola interrupción ni
 * gasta la apertura del día (D-18).
 */
export function InboxView({ system, initialTasks, initialCaptures }: InboxViewProps) {
  const { data: tasks = [] } = useTasks(system.id, initialTasks);
  const { mutate: toggle } = useToggleTask(system.id);
  const { data: capturas = [] } = useCaptures(initialCaptures);
  const { mutate: confirmar } = useConfirmCapture();
  const { mutate: descartar } = useDiscardCapture();
  const abrirCaptura = useQuickAddStore((s) => s.setOpen);
  const [triaging, setTriaging] = useState(false);
  const [open, setOpen] = useState<TaskTransport | null>(null);
  const [confirmando, setConfirmando] = useState<CaptureItem | null>(null);
  // Las tachadas en esta visita: siguen en su fila aunque el servidor ya las
  // cuente como hechas, y el Deshacer sólo devuelve lo que se tachó aquí.
  const [tachadas, setTachadas] = useState<ReadonlySet<string>>(() => new Set());
  const avisos = useRef(new Map<string, string | number>());

  const pending = tasks.filter((task) => task.status !== 'done');
  const enLista = tasks.filter((task) => task.status !== 'done' || tachadas.has(task.id));
  const sinConfirmar = capturas.filter((captura) => captura.status === 'pending');
  const visible = enLista.slice(0, ITEMS_VISIBLES);
  const rest = enLista.length - visible.length;
  const resumen = resumenSinConfirmar(sinConfirmar.length);

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

  return (
    <section aria-labelledby="bandeja-titulo" className="space-y-4">
      <Header id="bandeja-titulo" count={pending.length + capturas.length} resumen={resumen} />

      {enLista.length === 0 && capturas.length === 0 ? (
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

          {/* Con un solo item la lista no es una lista: es una cosa, y decir para
              qué sirve este sitio vale más que dibujar una fila suelta. */}
          {pending.length === 1 && capturas.length === 0 && (
            <p className="pb-1 pl-(--margen) text-sm text-muted-foreground">
              Una cosa esperando. Ábrela para mandarla a un sistema, o déjala ahí.
            </p>
          )}

          <ul className="[&>li:last-child>*]:border-b-0">
            {capturas.map((captura) => (
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
        onOpenChange={(next) => !next && setConfirmando(null)}
        onConfirm={(indices) => {
          if (confirmando) confirmar({ id: confirmando.id, indices });
          setConfirmando(null);
        }}
        onDiscard={() => {
          if (confirmando) descartar(confirmando.id);
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
 * El título de Bandeja con la misma rejilla que `PageHeader`: el h1 en la
 * columna de texto, a la derecha del margen; la cuenta a la derecha, en mute y
 * tabular; debajo, cuántas capturas esperan confirmación.
 */
function Header({ id, count, resumen }: { id: string; count: number; resumen: string | null }) {
  return (
    <div className="grid grid-cols-[var(--margen)_1fr_auto] items-baseline md:grid-cols-[0_1fr_auto]">
      <span aria-hidden />
      <div className="min-w-0 space-y-1">
        <h1 id={id} className="font-display text-[1.41rem] font-bold tracking-[-0.02em]">
          Bandeja
        </h1>
        {resumen && <p className="text-sm text-muted-foreground">{resumen}</p>}
      </div>
      <span className="font-display text-lg font-bold text-muted-foreground tabular-nums" aria-label={`${count} por repartir`}>
        {count}
      </span>
    </div>
  );
}
