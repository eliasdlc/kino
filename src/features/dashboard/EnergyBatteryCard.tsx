'use client';

import { useState } from 'react';
import { Battery, Moon, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import { useTodayCheckin, useCreateCheckin } from '@/features/energy/energy.hooks';
import type { Chronotype } from '@/features/energy/energy.utils';
import type { EnergyPlanItem } from '@/features/energy/energy.planner';
import type { Task } from '@/features/tasks/tasks.types';

interface EnergyBatteryCardProps {
  initialCheckin: { currentLevel: number; sleepQuality: string } | null;
  projectedCurve: readonly number[] | null;
  chronotype: Chronotype | null;
  scheduledItems?: EnergyPlanItem[];
  deferredTasks?: Task[];
}

const SLEEP_LABELS: Record<string, string> = {
  good: 'Bien',
  partial: 'Regular',
  poor: 'Mal',
};

const SLEEP_COLORS: Record<string, string> = {
  good: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 ring-emerald-500/30',
  partial: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 ring-amber-500/30',
  poor: 'bg-red-500/15 text-red-500 dark:text-red-400 ring-red-500/30',
};

const TASK_DOT_COLORS: Record<string, string> = {
  high: 'bg-amber-500',
  medium: 'bg-sky-400',
  low: 'bg-zinc-400',
};

function levelColor(level: number): string {
  if (level >= 70) return 'text-emerald-500';
  if (level >= 40) return 'text-amber-400';
  return 'text-red-400';
}

function progressColor(level: number): string {
  if (level >= 70) return '[&>div]:bg-emerald-500';
  if (level >= 40) return '[&>div]:bg-amber-400';
  return '[&>div]:bg-red-400';
}

function buildTaskDotMap(items: EnergyPlanItem[]): Map<number, EnergyPlanItem[]> {
  const map = new Map<number, EnergyPlanItem[]>();
  for (const item of items) {
    const hour = Math.min(23, Math.floor(item.scheduledStartMinute / 60));
    const existing = map.get(hour) ?? [];
    existing.push(item);
    map.set(hour, existing);
  }
  return map;
}

export function EnergyBatteryCard({
  initialCheckin,
  projectedCurve,
  chronotype,
  scheduledItems = [],
  deferredTasks = [],
}: EnergyBatteryCardProps) {
  const { data: liveCheckin } = useTodayCheckin();
  const { mutate: createCheckin, isPending } = useCreateCheckin();

  const [showForm, setShowForm] = useState(false);
  const [level, setLevel] = useState(70);
  const [sleep, setSleep] = useState<'good' | 'partial' | 'poor'>('good');

  const checkin = liveCheckin !== undefined ? liveCheckin : initialCheckin;
  const currentHour = new Date().getHours();
  const taskDotMap = buildTaskDotMap(scheduledItems);

  function handleSubmit() {
    createCheckin(
      { currentLevel: level, sleepQuality: sleep },
      { onSuccess: () => setShowForm(false) },
    );
  }

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Battery className="w-4 h-4 text-muted-foreground" />
          <p className="font-semibold text-sm">Energía de hoy</p>
          {chronotype && (
            <span className="text-xs text-muted-foreground capitalize">· {chronotype}</span>
          )}
        </div>
        {checkin && !showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Actualizar
          </button>
        )}
      </div>

      <div className="px-5 py-4 space-y-4">
        {/* Forecast — curva de capacidad + bloques de tareas */}
        {projectedCurve && (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">
              {scheduledItems.length > 0 ? 'Plan · capacidad y tareas' : 'Capacidad proyectada'}
            </p>
            <div className="relative flex items-end gap-[2px] h-14 w-full">
              {projectedCurve.map((val, h) => {
                const isCurrent = h === currentHour;
                const isPast = h < currentHour;
                const dots = taskDotMap.get(h) ?? [];
                return (
                  <div key={h} className="relative flex-1 flex flex-col items-center justify-end h-full">
                    {/* Task dots — positioned at top of each column */}
                    {dots.length > 0 && (
                      <div className="absolute top-0 flex flex-col items-center gap-[1px] z-10">
                        {dots.slice(0, 3).map((item, i) => (
                          <div
                            key={i}
                            title={item.task.title}
                            className={cn(
                              'w-1.5 h-1.5 rounded-full',
                              TASK_DOT_COLORS[item.task.energyLevel ?? 'medium'],
                            )}
                          />
                        ))}
                        {dots.length > 3 && (
                          <div className="text-[8px] text-muted-foreground/60 leading-none">
                            +{dots.length - 3}
                          </div>
                        )}
                      </div>
                    )}
                    {/* Capacity bar */}
                    <div
                      className={cn(
                        'w-full rounded-sm',
                        isCurrent
                          ? 'bg-amber-400'
                          : isPast
                            ? 'bg-muted-foreground/20'
                            : 'bg-sky-400/40',
                      )}
                      style={{ height: `${Math.max(4, (val / 100) * 52)}px` }}
                      title={`${h}:00 — ${Math.round(val)}`}
                    />
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between text-[10px] text-muted-foreground/60">
              <span>0h</span>
              <span>12h</span>
              <span>23h</span>
            </div>
          </div>
        )}

        {/* Estado: sin check-in */}
        {!checkin && !showForm && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Registra cómo te sientes para que Kino adapte el plan a tu energía real.
            </p>
            <Button size="sm" onClick={() => setShowForm(true)}>
              Registrar energía
            </Button>
          </div>
        )}

        {/* Nivel actual */}
        {checkin && !showForm && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Nivel actual</span>
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    'text-xs px-2 py-0.5 rounded-full font-medium ring-1',
                    SLEEP_COLORS[checkin.sleepQuality] ?? SLEEP_COLORS.good,
                  )}
                >
                  <Moon className="inline w-3 h-3 mr-1" />
                  {SLEEP_LABELS[checkin.sleepQuality] ?? checkin.sleepQuality}
                </span>
                <span className={cn('text-lg font-bold tabular-nums', levelColor(checkin.currentLevel))}>
                  {checkin.currentLevel}
                </span>
              </div>
            </div>
            <Progress
              value={checkin.currentLevel}
              className={cn('h-2', progressColor(checkin.currentLevel))}
            />
          </div>
        )}

        {/* Formulario inline */}
        {showForm && (
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">¿Cómo está tu energía? (1–100)</p>
                <span className={cn('text-sm font-bold tabular-nums', levelColor(level))}>
                  {level}
                </span>
              </div>
              <Slider
                min={1}
                max={100}
                step={1}
                value={[level]}
                onValueChange={([v]) => v !== undefined && setLevel(v)}
                className="w-full"
              />
            </div>

            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">¿Cómo dormiste?</p>
              <div className="flex gap-2">
                {(['good', 'partial', 'poor'] as const).map((q) => (
                  <button
                    key={q}
                    onClick={() => setSleep(q)}
                    className={cn(
                      'flex-1 text-xs py-1.5 rounded-md border font-medium transition-colors',
                      sleep === q
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border hover:bg-accent/50 text-muted-foreground',
                    )}
                  >
                    {SLEEP_LABELS[q]}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <Button size="sm" onClick={handleSubmit} disabled={isPending} className="flex-1">
                {isPending ? 'Guardando…' : 'Guardar'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowForm(false)}
                disabled={isPending}
              >
                Cancelar
              </Button>
            </div>
          </div>
        )}

        {/* Tareas diferidas por energía insuficiente */}
        {deferredTasks.length > 0 && !showForm && (
          <div className="space-y-1.5 pt-1 border-t">
            <div className="flex items-center gap-1.5">
              <Clock className="w-3 h-3 text-muted-foreground/60" />
              <p className="text-xs text-muted-foreground">
                Diferidas ({deferredTasks.length})
              </p>
            </div>
            {deferredTasks.slice(0, 3).map((task) => (
              <div key={task.id} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="size-1.5 rounded-full bg-muted-foreground/30 shrink-0" />
                <span className="truncate">{task.title}</span>
              </div>
            ))}
            {deferredTasks.length > 3 && (
              <p className="text-xs text-muted-foreground/50">
                y {deferredTasks.length - 3} más
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
