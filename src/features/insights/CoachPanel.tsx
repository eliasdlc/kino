'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation } from 'convex/react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { api } from '@convex/_generated/api';
import {
  useSuggestedTasks,
  useEnergyDistribution,
  useStaleSystems,
} from './insights.hooks';

type Tab = 'suggestion' | 'energy' | 'stale';

// ── Skeleton & empty state ────────────────────────────────────────────────

/** Renglones esperando, sin latido. */
function SlotSkeleton({ rows }: { rows: number }) {
  return (
    <div className="space-y-3" aria-busy>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="space-y-1.5">
          <div className="h-3 w-3/4 rounded bg-muted" />
          <div className="h-2.5 w-1/2 rounded bg-muted/60" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return <p className="text-[0.84rem] text-muted-foreground">{message}</p>;
}

// ── Slot: Sugerencia del día ──────────────────────────────────────────────

function SuggestionSlot() {
  const { data: tasks, isLoading } = useSuggestedTasks(3);
  const bulkMove = useMutation(api.tasks.bulkMove);
  const [moving, setMoving] = useState<string | null>(null);

  async function moveToToday(taskId: string) {
    setMoving(taskId);
    try {
      await bulkMove({ taskIds: [taskId as never], status: 'today' });
      toast.success('Tarea movida a hoy');
    } catch {
      toast.error('No se pudo mover la tarea');
    } finally {
      setMoving(null);
    }
  }

  if (isLoading) return <SlotSkeleton rows={3} />;
  if (!tasks?.length) return <EmptyState message="Sin sugerencias por ahora" />;

  return (
    <ul>
      {tasks.map((task) => (
        <li key={task.id} className="flex min-w-0 items-center gap-2 border-b border-border py-1 last:border-b-0">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm leading-snug font-semibold">{task.title}</p>
            <p className="truncate text-[0.78rem] text-muted-foreground">{task.why}</p>
          </div>
          {task.status !== 'today' && (
            // Mientras se mueve, el botón lo dice en palabras: ningún spinner.
            <Button
              variant="ghost"
              className="shrink-0 px-3"
              disabled={moving === task.id}
              aria-busy={moving === task.id}
              onClick={() => moveToToday(task.id)}
            >
              {moving === task.id ? 'Moviendo' : 'Hacer ahora'}
            </Button>
          )}
        </li>
      ))}
    </ul>
  );
}

// ── Slot: Distribución de energía ─────────────────────────────────────────

function EnergySlot() {
  const { data, isLoading } = useEnergyDistribution(7);

  if (isLoading) return <SlotSkeleton rows={3} />;
  if (!data || data.total === 0)
    return <EmptyState message="Sin tareas completadas esta semana" />;

  return (
    <ul className="space-y-2.5">
      {data.systems.slice(0, 5).map((s) => (
        <li key={s.systemId} className="space-y-1">
          <div className="flex justify-between gap-2 text-[0.82rem] text-muted-foreground">
            <span className="truncate">{s.systemName}</span>
            <span className="shrink-0 tabular-nums">{s.percentage} %</span>
          </div>
          {/* La barra se escala con scaleX desde la izquierda, nunca con width. */}
          <div className="h-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full w-full origin-left rounded-full bg-primary/70"
              style={{ transform: `scaleX(${(Math.max(0, Math.min(100, s.percentage)) / 100).toFixed(3)})` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

// ── Slot: Sistemas dormidos ───────────────────────────────────────────────

function StaleSlot() {
  const { data: systems, isLoading } = useStaleSystems(14);

  if (isLoading) return <SlotSkeleton rows={2} />;
  if (!systems?.length)
    return <EmptyState message="Todos los sistemas activos" />;

  return (
    <ul>
      {systems.slice(0, 4).map((s) => (
        <li key={s.systemId} className="flex min-w-0 items-center justify-between gap-2 border-b border-border py-1 last:border-b-0">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{s.systemName}</p>
            <p className="text-[0.78rem] text-muted-foreground tabular-nums">
              Sin actividad hace {s.daysSinceActivity} días
            </p>
          </div>
          <Button variant="ghost" className="shrink-0 px-3" asChild>
            <Link href={`/systems/${s.systemId}`}>Retomar</Link>
          </Button>
        </li>
      ))}
    </ul>
  );
}

// ── Panel principal ───────────────────────────────────────────────────────

const TABS: { id: Tab; label: string }[] = [
  { id: 'suggestion', label: 'Sugerencia' },
  { id: 'energy', label: 'Energía' },
  { id: 'stale', label: 'Sistemas' },
];

/**
 * El coach de Hoy: tres botones de palabra, sin icono, cada uno con su blanco
 * de 48 px y el elegido subrayado en tinta. Son botones con `aria-pressed` y
 * no un patrón de pestañas a medias: un lector que anuncia pestañas promete
 * flechas y foco rodante, y aquí basta con elegir qué mirar. Los textos
 * crecen con la letra del sistema (rem, nunca píxeles fijos), y lo que está
 * en curso se dice con una palabra, no con un spinner.
 *
 * Los botones de cada fila no se salen del borde derecho con un margen
 * negativo: el panel tiene scroll vertical, y un hijo que sobresale abre
 * también un recorrido horizontal y recorta su propio blanco.
 */
export function CoachPanel() {
  const [tab, setTab] = useState<Tab>('suggestion');

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div role="group" aria-label="Qué mirar del coach" className="flex shrink-0 gap-1 border-b border-border">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            aria-pressed={tab === id}
            onClick={() => setTab(id)}
            className={cn(
              'focus-ring -mb-px inline-flex min-h-[2.85rem] items-center border-b-2 px-3 text-[0.84rem] font-semibold transition-colors duration-(--dur-toque) ease-(--ease-pluma) first:pl-0',
              tab === id
                ? 'border-foreground text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div data-slot="coach-content" className="min-h-0 flex-1 overflow-y-auto pt-2">
        {tab === 'suggestion' && <SuggestionSlot />}
        {tab === 'energy' && <EnergySlot />}
        {tab === 'stale' && <StaleSlot />}
      </div>
    </div>
  );
}
