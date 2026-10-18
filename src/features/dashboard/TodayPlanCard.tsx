'use client';

import { useEffect, useRef, useState } from 'react';
import { Coffee } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  useTodayPlanTasks,
  useToggleTodayTask,
  useMoveToTomorrow,
  useRemoveFromPlan,
} from '@/features/tasks/tasks.hooks';
import { useFocusTimer } from '@/features/tasks/FocusTimerProvider';
import { Skeleton } from '@/components/ui/skeleton';
import { userTomorrow } from '@/shared/time';
import { PlanTaskRow } from './PlanTaskRow';
import { SectionHead } from './SectionHead';
import type { EnergyPlanItemTransport } from '@/features/energy/energy.planner';
import type { TaskTransport } from '@/features/tasks/tasks.types';

interface TodayPlanCardProps {
  noProfile: boolean;
  energyItems?: EnergyPlanItemTransport[];
}

/** Lo que dura el Deshacer de una fila tachada. */
export const UNDO_MS = 4000;

const PRIORITY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

// Confeti al cerrar el plan: doce puntos en transform y opacity, y el bloque
// global de reduced motion lo apaga con el resto.
const CONFETTI_COUNT = 12;
const CONFETTI_FLIGHT_MS = 700;
const CONFETTI_STAGGER_MS = 30;
/**
 * Cuándo se desmonta: el vuelo del último punto (su retraso más los 700 ms)
 * y un margen, para que ninguna partícula se corte a media trayectoria.
 */
export const CONFETTI_REMOVE_MS = CONFETTI_FLIGHT_MS + (CONFETTI_COUNT - 1) * CONFETTI_STAGGER_MS + 70;

function ConfettiBurst() {
  const spans = Array.from({ length: CONFETTI_COUNT }, (_, i) => ({ id: i, angle: (i / CONFETTI_COUNT) * 360 }));
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {spans.map(({ id, angle }) => (
        <span
          key={id}
          data-slot="confetti"
          className="absolute top-1/2 left-1/2 size-2 rounded-full bg-primary"
          style={{
            animation: `confetti-fly ${CONFETTI_FLIGHT_MS}ms var(--ease-pluma) forwards`,
            animationDelay: `${id * CONFETTI_STAGGER_MS}ms`,
            '--angle': `${angle}deg`,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}

/** Suma de las estimaciones pendientes, como "4:15"; vacío si nadie estimó. */
export function totalEstimated(tasks: readonly TaskTransport[]): string {
  const minutes = tasks.reduce((sum, t) => {
    if (!t.estimatedTime) return sum;
    const [h = '0', m = '0'] = t.estimatedTime.split(':');
    return sum + parseInt(h, 10) * 60 + parseInt(m, 10);
  }, 0);
  if (minutes === 0) return '';
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`;
}

/** Tres filas de margen esperando, sin latido. */
function PlanSkeleton() {
  return (
    <div aria-busy>
      {[0, 1, 2].map((i) => (
        <div key={i} className="grid min-h-[3.4rem] grid-cols-[var(--margen)_1fr] items-center border-b border-border last:border-b-0">
          <div className="flex justify-center">
            <Skeleton className="size-[1.35rem] rounded-full" />
          </div>
          <div className="space-y-1.5 py-2">
            <Skeleton className={i === 0 ? 'h-4 w-4/5' : i === 1 ? 'h-4 w-3/5' : 'h-4 w-2/3'} />
            <Skeleton className="h-3 w-2/5" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * El vacío del plan. Va en h3 y no en h2: el h1 de la pantalla es la palabra
 * de la cota y "Plan de hoy" ya es el h2 de la sección, así que el titular del
 * vacío cuelga de él. Por la misma razón pesa menos que el título de sección:
 * Figtree en peso, no Bricolage, y la frase en la voz debajo.
 */
function PlanEmpty({ title, description, action }: { title: string; description: string; action: React.ReactNode }) {
  return (
    <div data-slot="plan-empty" className="flex flex-col items-start gap-1 py-5 pl-(--margen)">
      <h3 className="text-base leading-tight font-semibold text-foreground">{title}</h3>
      <p className="font-voice text-[0.98rem] leading-snug text-body italic">{description}</p>
      <div className="mt-1">{action}</div>
    </div>
  );
}

const linkAccion = 'focus-ring inline-flex h-[2.85rem] items-center rounded-full font-semibold text-primary';

/**
 * El plan de hoy: un título con hairline y filas de margen debajo. Completar
 * es un toque en el círculo: la fila se tacha, un aviso de cuatro segundos
 * ofrece Deshacer, y la fila tachada se queda en su sitio hasta la siguiente
 * visita, porque una lista que recoloca sus renglones a los cuatro segundos
 * mueve lo que la persona está leyendo. Lo vacío y lo hecho del todo son un
 * estado vacío en la columna de texto, no una tarjeta.
 *
 * El Deshacer del aviso devuelve el estado de antes de completar, no alterna:
 * si la fila ya se deshizo con el círculo, el aviso se cierra en ese toque, y
 * un Deshacer tardío que llegue igual no hace nada. La mutación del servidor
 * es un flip, así que alternar a ciegas volvería a dejar la tarea hecha.
 */
export function TodayPlanCard({ noProfile, energyItems }: TodayPlanCardProps) {
  const { data: planTasks = [], isLoading } = useTodayPlanTasks();
  const { mutate: toggle } = useToggleTodayTask();
  const { mutate: moveToTomorrow } = useMoveToTomorrow();
  const { mutate: removeFromPlan } = useRemoveFromPlan();
  const { openModeDialog } = useFocusTimer();

  const [showConfetti, setShowConfetti] = useState(false);
  const confettiTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (confettiTimer.current) clearTimeout(confettiTimer.current);
  }, []);
  // Las que se completaron aquí y siguen hechas según el último gesto de la
  // persona, con el aviso que ofrece deshacerlas. Es la fuente del Deshacer:
  // no depende de que el servidor ya haya contestado.
  const completedHere = useRef(new Map<string, string | number | undefined>());
  // Las tachadas en esta visita. Siguen en su fila aunque el servidor ya las
  // cuente como hechas; la próxima apertura de Hoy las baja a "hechas hoy".
  const [struck, setStruck] = useState<ReadonlySet<string>>(() => new Set());

  const pendingTasks = planTasks.filter((t) => t.status !== 'done');
  const doneTasks = planTasks.filter((t) => t.status === 'done');
  const totalToday = planTasks.length;
  const doneCount = doneTasks.length;
  const isEmpty = totalToday === 0;

  const energyOrderMap = new Map(energyItems?.map((item, i) => [item.task.id, i]));
  const breakBeforeIds = new Set(energyItems?.filter((item) => item.breakBefore).map((item) => item.task.id) ?? []);

  // Las filas visibles: las pendientes más las tachadas aquí, en el orden del
  // plan, que no depende del estado y por eso no salta al tachar.
  const visible = planTasks
    .filter((t) => t.status !== 'done' || struck.has(t.id))
    .sort((a, b) => {
      if (energyItems?.length) return (energyOrderMap.get(a.id) ?? 999) - (energyOrderMap.get(b.id) ?? 999);
      return (PRIORITY_ORDER[a.effectivePriority] ?? 2) - (PRIORITY_ORDER[b.effectivePriority] ?? 2);
    });
  const settledDone = doneTasks.filter((t) => !struck.has(t.id)).length;

  /** Vuelve a pendiente sólo si el último gesto la dejó hecha: idempotente. */
  function undo(taskId: string) {
    if (!completedHere.current.has(taskId)) return;
    completedHere.current.delete(taskId);
    toggle({ taskId });
  }

  function strike(task: TaskTransport) {
    const willBeAllDone = pendingTasks.filter((t) => t.id !== task.id).length === 0;
    setStruck((prev) => new Set(prev).add(task.id));
    toggle({ taskId: task.id });
    const toastId = toast(`Hecha: ${task.title}`, {
      duration: UNDO_MS,
      action: { label: 'Deshacer', onClick: () => undo(task.id) },
    });
    completedHere.current.set(task.id, toastId);
    if (willBeAllDone) {
      setShowConfetti(true);
      if (confettiTimer.current) clearTimeout(confettiTimer.current);
      confettiTimer.current = setTimeout(() => setShowConfetti(false), CONFETTI_REMOVE_MS);
    }
  }

  function handleToggle(task: TaskTransport) {
    if (task.status !== 'done' && !completedHere.current.has(task.id)) {
      strike(task);
      return;
    }
    // Deshacer con el círculo cierra el aviso: su Deshacer ya no tiene nada
    // que devolver.
    const toastId = completedHere.current.get(task.id);
    if (toastId !== undefined) toast.dismiss(toastId);
    if (completedHere.current.has(task.id)) undo(task.id);
    else toggle({ taskId: task.id });
  }

  const duration = totalEstimated(pendingTasks);
  const summary = [
    totalToday > 0 ? `${totalToday} tarea${totalToday === 1 ? '' : 's'}` : null,
    doneCount > 0 ? `${doneCount} hecha${doneCount === 1 ? '' : 's'}` : null,
    duration,
  ]
    .filter(Boolean)
    .join(', ');

  const showRows = visible.length > 0;

  return (
    <section aria-label="Plan de hoy" className="relative">
      {showConfetti && <ConfettiBurst />}

      <SectionHead title="Plan de hoy" count={summary} />

      {isLoading && <PlanSkeleton />}

      {!isLoading && noProfile && (
        <PlanEmpty
          title="Sin perfil de energía"
          description="El plan sale de tu perfil de energía; sin él no hay con qué proponerlo."
          action={
            <Link href="/onboarding" className={linkAccion}>
              Configurarlo
            </Link>
          }
        />
      )}

      {!isLoading && !noProfile && !showRows && doneCount > 0 && (
        <PlanEmpty
          title="Todo hecho por hoy"
          description={`${doneCount} tarea${doneCount === 1 ? '' : 's'} cerrada${doneCount === 1 ? '' : 's'}. El resto del día es tuyo.`}
          action={
            <Link href="/tasks" className={linkAccion}>
              Ver sugerencias
            </Link>
          }
        />
      )}

      {!isLoading && !noProfile && isEmpty && (
        <PlanEmpty
          title="Nada en el plan"
          description="Una página en blanco. Las sugerencias esperan en Tareas."
          action={
            <Link href="/tasks" className={linkAccion}>
              Ver sugerencias
            </Link>
          }
        />
      )}

      {!isLoading && !noProfile && showRows && (
        <div>
          {visible.map((task, i) => (
            <div key={task.id} className="border-b border-border last:border-b-0">
              {breakBeforeIds.has(task.id) && i > 0 && (
                <div className="flex items-center gap-2 py-2 pl-(--margen) text-[0.82rem] text-muted-foreground">
                  <Coffee className="size-3.5 shrink-0" />
                  <span>Pausa sugerida aquí</span>
                </div>
              )}
              <PlanTaskRow
                task={task}
                struck={struck.has(task.id)}
                onComplete={() => handleToggle(task)}
                onMoveToTomorrow={() =>
                  moveToTomorrow({
                    taskId: task.id,
                    tomorrow: userTomorrow(Intl.DateTimeFormat().resolvedOptions().timeZone),
                  })
                }
                onRemove={() => removeFromPlan({ taskId: task.id })}
                onStartTimer={() => openModeDialog({ id: task.id, title: task.title, systemId: task.systemId })}
              />
            </div>
          ))}
          {settledDone > 0 && (
            <p className="py-2.5 pl-(--margen) text-[0.82rem] text-muted-foreground tabular-nums">
              {settledDone} hecha{settledDone === 1 ? '' : 's'} hoy
            </p>
          )}
        </div>
      )}
    </section>
  );
}
