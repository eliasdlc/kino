'use client';

import { useState } from 'react';
import { GitBranch, Link2, Mic } from 'lucide-react';
import { CascadeInboxMode } from '@/features/tasks/CascadeInboxMode';
import { TaskDetailSheet } from '@/features/tasks/TaskDetailSheet';
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

/**
 * Glifo por fuente conocida. Una fuente que no conoce no se dibuja. El hueco de
 * la derecha de cada fila lo comparten las tareas y las capturas, que es lo que
 * permite que las dos vivan en la misma lista sin cambiar de forma.
 */
const SOURCE_GLYPHS: Record<string, typeof Link2> = {
  github: GitBranch,
  link: Link2,
  voice: Mic,
};

/**
 * Bandeja: el embudo de triaje. No tiene carpetas a propósito, así que tampoco
 * tiene el funnel de cuatro tabs de los demás sistemas: lo único que se hace
 * aquí es mirar lo que entró y repartirlo.
 *
 * Aquí vive el primero de los dos empujes del principio 7. Es una fila de
 * estado sin pregunta, así que no pasa por la cola de una sola interrupción ni
 * gasta la apertura del día (D-18).
 */
export function InboxView({ system, initialTasks }: SystemViewProps) {
  const { data: tasks = [] } = useTasks(system.id, initialTasks);
  const { mutate: toggle } = useToggleTask(system.id);
  const { data: capturas = [] } = useCaptures();
  const { mutate: confirmar } = useConfirmCapture();
  const { mutate: descartar } = useDiscardCapture();
  const [triaging, setTriaging] = useState(false);
  const [open, setOpen] = useState<TaskTransport | null>(null);
  const [confirmando, setConfirmando] = useState<CaptureItem | null>(null);

  const pending = tasks.filter((task) => task.status !== 'done');
  const sinConfirmar = capturas.filter((captura) => captura.status === 'pending');
  const visible = pending.slice(0, ITEMS_VISIBLES);
  const rest = pending.length - visible.length;

  if (pending.length === 0 && capturas.length === 0) {
    return (
      <section aria-labelledby="bandeja-titulo" className="space-y-2">
        <Header id="bandeja-titulo" count={0} />
        <p className="text-sm text-muted-foreground">
          Bandeja está vacía. Lo que captures sin decidir dónde va aterriza aquí.
        </p>
      </section>
    );
  }

  return (
    <section aria-labelledby="bandeja-titulo">
      <Header id="bandeja-titulo" count={pending.length + capturas.length} />

      {resumenSinConfirmar(sinConfirmar.length) && (
        <p className="pt-1 text-sm text-muted-foreground">{resumenSinConfirmar(sinConfirmar.length)}</p>
      )}

      <GroupNudge count={pending.length} onTriage={() => setTriaging(true)} />

      {/* Con un solo item la lista no es una lista: es una cosa, y decir para
          qué sirve este sitio vale más que dibujar una fila suelta. */}
      {pending.length === 1 && (
        <p className="pt-3 text-sm text-muted-foreground">
          Una cosa esperando. Ábrela para mandarla a un sistema, o déjala ahí.
        </p>
      )}

      <ul className="pt-1">
        {capturas.map((captura) => (
          <CaptureRow key={captura.id} captura={captura} onOpen={setConfirmando} />
        ))}
        {visible.map((task) => {
          const Glyph = task.externalSource ? SOURCE_GLYPHS[task.externalSource] : undefined;
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
              {/* El hueco de la fuente, reservado aunque hoy casi nada lo use. */}
              <span className="grid size-6 shrink-0 place-items-center text-muted-foreground">
                {Glyph && <Glyph className="size-3.5 stroke-2" aria-label={task.externalSource!} />}
              </span>
            </li>
          );
        })}
      </ul>

      {rest > 0 && (
        <p className="pt-3 text-sm text-muted-foreground">
          Quedan {rest} más sin pintar. Repártelas y la lista baja.
        </p>
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

function Header({ id, count }: { id: string; count: number }) {
  return (
    <div className="flex items-baseline gap-3">
      <h2 id={id} className="font-display text-xl font-bold tracking-[-0.02em]">
        Bandeja
      </h2>
      <span className="ml-auto font-mono text-sm text-muted-foreground tabular-nums">{count}</span>
    </div>
  );
}
