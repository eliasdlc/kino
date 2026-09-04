'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, BarChart2, Moon, Loader2 } from 'lucide-react';
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

function SlotSkeleton({ rows }: { rows: number }) {
  return (
    <div className="space-y-2.5 animate-pulse">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="space-y-1">
          <div className="h-2.5 w-3/4 bg-muted rounded" />
          <div className="h-2 w-1/2 bg-muted/60 rounded" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return <p className="text-xs text-muted-foreground">{message}</p>;
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
    <ul className="space-y-2">
      {tasks.map((task) => (
        <li key={task.id} className="flex items-start gap-2 min-w-0">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium leading-snug truncate">{task.title}</p>
            <p className="text-[10px] text-muted-foreground truncate">{task.why}</p>
          </div>
          {task.status !== 'today' && (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-[10px] shrink-0 hover:bg-muted"
              disabled={moving === task.id}
              onClick={() => moveToToday(task.id)}
            >
              {moving === task.id ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                'Hacer ahora'
              )}
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
        <li key={s.systemId} className="space-y-0.5">
          <div className="flex justify-between">
            <span className="text-[10px] text-muted-foreground truncate">{s.systemName}</span>
            <span className="text-[10px] text-muted-foreground shrink-0 ml-1">
              {s.percentage}%
            </span>
          </div>
          <div className="h-1 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-amber-400/80 transition-all duration-500"
              style={{ width: `${s.percentage}%` }}
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
    <ul className="space-y-2">
      {systems.slice(0, 4).map((s) => (
        <li key={s.systemId} className="flex items-center justify-between gap-2 min-w-0">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate">{s.systemName}</p>
            <p className="text-[10px] text-muted-foreground">
              Sin actividad hace {s.daysSinceActivity} días
            </p>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-[10px] shrink-0 hover:bg-muted"
            asChild
          >
            <Link href={`/systems/${s.systemId}`}>Retomar</Link>
          </Button>
        </li>
      ))}
    </ul>
  );
}

// ── Panel principal ───────────────────────────────────────────────────────

const TABS: { id: Tab; label: string; Icon: React.FC<{ className?: string }> }[] = [
  { id: 'suggestion', label: 'Sugerencia', Icon: ArrowRight },
  { id: 'energy', label: 'Energía', Icon: BarChart2 },
  { id: 'stale', label: 'Sistemas', Icon: Moon },
];

export function CoachPanel() {
  const [tab, setTab] = useState<Tab>('suggestion');

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Tab bar */}
      <div className="flex border-b shrink-0">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              'flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-semibold border-b-2 transition-colors',
              tab === id
                ? 'border-foreground text-foreground -mb-px'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon className="w-3 h-3" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content — scrolls within the card */}
      <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2.5">
        {tab === 'suggestion' && <SuggestionSlot />}
        {tab === 'energy' && <EnergySlot />}
        {tab === 'stale' && <StaleSlot />}
      </div>
    </div>
  );
}
