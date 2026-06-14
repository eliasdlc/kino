'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Battery, Moon, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  useTodayCheckins,
  useCreateCheckin,
  useUpdateCheckinAccuracy,
} from '@/features/energy/energy.hooks';
import { findPeakRange, formatHourRange, CHRONOTYPE_LABELS } from '@/features/energy/energy.utils';
import type { CheckinSlot } from '@/features/energy/energy.schemas';
import type { Chronotype } from '@/features/energy/energy.utils';
import type { Task } from '@/features/tasks/tasks.types';
import type { TodayCheckinRow } from '@/features/energy/energy.service';
import { EnergyChart, type ChartEntry } from './EnergyChart';
import { EnergyCheckinForm, type CheckinValues } from './EnergyCheckinForm';
import {
  SLOT_LABELS,
  SLEEP_LABELS,
  SLEEP_COLORS,
  levelColor,
  getCurrentSlot,
  interpretEnergy,
} from './energyDisplay';

interface EnergyTodayCardProps {
  initialCheckins: TodayCheckinRow[];
  projectedCurve: number[];
  chronotype: Chronotype | null;
  deferredTasks?: Task[];
}

const SLOT_MIDPOINT: Record<CheckinSlot, number> = { morning: 9, afternoon: 15, evening: 20 };

const TONE_RING: Record<string, string> = {
  high: 'ring-emerald-500/40',
  medium: 'ring-amber-400/40',
  low: 'ring-red-400/40',
};

const TONE_GLOW: Record<string, string> = {
  high: 'bg-emerald-500/25',
  medium: 'bg-amber-400/25',
  low: 'bg-red-400/25',
};

function buildChartData(curve: number[], checkins: TodayCheckinRow[]): ChartEntry[] {
  return Array.from({ length: 24 }, (_, hour) => {
    const checkin = checkins.find((c) => new Date(c.createdAt).getHours() === hour);
    return {
      hour,
      predicted: Math.round(curve[hour] ?? 0),
      actual: checkin ? checkin.currentLevel : null,
    };
  });
}

function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
      mq.addEventListener('change', cb);
      return () => mq.removeEventListener('change', cb);
    },
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    () => false,
  );
}

/** Cuenta de 0 → target al montar; anima los cambios posteriores. */
function useCountUp(target: number, enabled: boolean, durationMs = 550): number {
  const [val, setVal] = useState(0);
  const fromRef = useRef(0);
  useEffect(() => {
    if (!enabled) {
      fromRef.current = target;
      return;
    }
    const from = fromRef.current;
    if (from === target) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setVal(Math.round(from + (target - from) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, enabled, durationMs]);
  return enabled ? val : target;
}

export function EnergyTodayCard({
  initialCheckins,
  projectedCurve,
  chronotype,
  deferredTasks = [],
}: EnergyTodayCardProps) {
  const { data: liveCheckins } = useTodayCheckins();
  const { mutate: createCheckin, isPending } = useCreateCheckin();
  const { mutate: updateAccuracy, isPending: isUpdatingAccuracy } = useUpdateCheckinAccuracy();

  const checkins = liveCheckins ?? initialCheckins;
  const currentSlot = getCurrentSlot();
  const currentHour = new Date().getHours();
  const hasCurve = projectedCurve.length === 24;

  const animate = !usePrefersReducedMotion();

  const [selectedSlot, setSelectedSlot] = useState<CheckinSlot>(currentSlot);
  const [showForm, setShowForm] = useState(false);

  const isCurrent = selectedSlot === currentSlot;
  const slotCheckin = checkins.find((c) => c.slot === selectedSlot) ?? null;
  const currentSlotCheckin = checkins.find((c) => c.slot === currentSlot) ?? null;

  const readingHour = isCurrent ? currentHour : SLOT_MIDPOINT[selectedSlot];
  const predictedValue = hasCurve ? Math.round(projectedCurve[readingHour] ?? 0) : 0;
  const isReal = slotCheckin !== null;
  const heroValue = isReal ? slotCheckin.currentLevel : predictedValue;
  const reading = interpretEnergy(heroValue);
  const animatedValue = useCountUp(heroValue, animate);

  const peak = hasCurve ? findPeakRange(projectedCurve) : null;
  const chartData = hasCurve ? buildChartData(projectedCurve, checkins) : null;
  const diff = isReal ? slotCheckin.currentLevel - predictedValue : null;

  const hasAnyCheckin = checkins.length > 0;
  const showPredictionFeedback =
    currentSlotCheckin !== null && currentSlotCheckin.predictionAccuracy === null && hasCurve;

  function handleSubmit({ level, slot, sleep }: CheckinValues) {
    createCheckin(
      { currentLevel: level, slot, ...(slot === 'morning' ? { sleepQuality: sleep } : {}) },
      { onSuccess: () => { setShowForm(false); setSelectedSlot(slot); } },
    );
  }

  return (
    <div className="rounded-xl border bg-card overflow-hidden flex flex-col shrink-0">
      <div className="px-5 py-3 border-b flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Battery className="w-4 h-4 text-muted-foreground" />
          <p className="font-semibold text-sm">Energía de hoy</p>
          {chronotype && (
            <span className="text-xs text-muted-foreground">· {CHRONOTYPE_LABELS[chronotype]}</span>
          )}
        </div>
        {hasAnyCheckin && !showForm && (
          <button
            onClick={() => { setSelectedSlot(currentSlot); setShowForm(true); }}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Actualizar
          </button>
        )}
      </div>

      <div className="px-5 py-3.5 space-y-3.5">
        {showForm ? (
          <EnergyCheckinForm
            initialSlot={currentSlot}
            isPending={isPending}
            onSubmit={handleSubmit}
            onCancel={() => setShowForm(false)}
          />
        ) : (
          <>
            {/* Lectura "ahora" — la medición */}
            <div className="flex items-center gap-3 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:duration-300 motion-safe:fill-mode-both">
              <div className="relative shrink-0">
                <div
                  className={cn(
                    'absolute inset-0 rounded-xl blur-md motion-safe:animate-[breath_3.5s_ease-in-out_infinite]',
                    TONE_GLOW[reading.tone],
                  )}
                  aria-hidden
                />
                <div
                  key={heroValue}
                  className={cn(
                    'relative flex items-center justify-center w-[68px] h-[68px] rounded-xl bg-card ring-2 transition-shadow',
                    'motion-safe:animate-in motion-safe:zoom-in-95 motion-safe:duration-300',
                    TONE_RING[reading.tone],
                  )}
                >
                  <span className={cn('text-3xl font-bold tabular-nums', levelColor(heroValue))}>
                    {animatedValue}
                  </span>
                </div>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-semibold">
                    {isCurrent ? 'Ahora' : SLOT_LABELS[selectedSlot]} · {reading.label}
                  </p>
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground/70">
                    {isReal ? 'registrado' : 'previsto'}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{reading.hint}</p>
                {isReal && diff !== null && (
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Previsto {predictedValue} ·{' '}
                    <span className={cn(Math.abs(diff) <= 8 ? 'text-emerald-500' : 'text-amber-500')}>
                      {diff > 0 ? '+' : ''}{diff} vs predicción
                    </span>
                  </p>
                )}
              </div>
            </div>

            {/* Gráfico + leyenda */}
            {chartData && (
              <div
                className="space-y-1.5 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300 motion-safe:fill-mode-both"
                style={{ animationDelay: '60ms' }}
              >
                <EnergyChart data={chartData} peak={peak} currentHour={currentHour} animate={animate} />
                <div className="flex items-center justify-between text-[10px] text-muted-foreground/70">
                  <span className="inline-flex items-center gap-1">
                    <span className="w-2 h-2 rounded-sm bg-amber-400" aria-hidden />
                    {peak ? `Pico ${formatHourRange(peak.start, peak.end)}` : 'Tu pico'}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-foreground ring-1 ring-background" aria-hidden />
                    Registrado
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span
                      className="inline-block w-3 border-t border-dashed border-foreground/60 motion-safe:animate-pulse"
                      aria-hidden
                    />
                    Ahora
                  </span>
                </div>
              </div>
            )}

            {/* Selector de slots */}
            <div
              className="flex gap-1.5 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300 motion-safe:fill-mode-both"
              style={{ animationDelay: '120ms' }}
            >
              {(Object.keys(SLOT_LABELS) as CheckinSlot[]).map((slot) => {
                const hasCheckin = checkins.some((c) => c.slot === slot);
                const isNow = slot === currentSlot;
                return (
                  <button
                    key={slot}
                    onClick={() => setSelectedSlot(slot)}
                    className={cn(
                      'flex-1 text-xs py-1 rounded-md border transition-all active:scale-95 relative',
                      selectedSlot === slot
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border hover:bg-accent/50 text-muted-foreground',
                      isNow && selectedSlot !== slot && 'border-dashed',
                    )}
                  >
                    {SLOT_LABELS[slot]}
                    {hasCheckin && (
                      <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-500" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Sueño del slot mañana */}
            {slotCheckin && selectedSlot === 'morning' && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Sueño</span>
                <span
                  className={cn(
                    'text-xs px-2 py-0.5 rounded-full font-medium ring-1',
                    SLEEP_COLORS[slotCheckin.sleepQuality] ?? SLEEP_COLORS.good,
                  )}
                >
                  <Moon className="inline w-3 h-3 mr-1" />
                  {SLEEP_LABELS[slotCheckin.sleepQuality] ?? slotCheckin.sleepQuality}
                </span>
              </div>
            )}

            {/* CTA sin check-in del slot actual */}
            {!currentSlotCheckin && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  {hasAnyCheckin
                    ? `Sin registro para la ${SLOT_LABELS[currentSlot].toLowerCase()} — registra cómo vas ahora.`
                    : 'Registra tu energía para que Kino mida tu día real y afine la predicción.'}
                </p>
                <Button size="sm" onClick={() => { setSelectedSlot(currentSlot); setShowForm(true); }}>
                  Registrar energía · {SLOT_LABELS[currentSlot]}
                </Button>
              </div>
            )}

            {/* Feedback de precisión */}
            {showPredictionFeedback && (
              <div className="space-y-1.5 pt-1 border-t">
                <p className="text-xs text-muted-foreground">¿Acertó la predicción de hoy?</p>
                <div className="flex gap-2">
                  {[
                    { key: 'accurate' as const, label: '✓ Sí' },
                    { key: 'partial' as const, label: '~ Más o menos' },
                    { key: 'inaccurate' as const, label: '✗ No' },
                  ].map(({ key, label }) => (
                    <button
                      key={key}
                      onClick={() => updateAccuracy({ accuracy: key, slot: currentSlot })}
                      disabled={isUpdatingAccuracy}
                      className="flex-1 text-xs py-1 rounded-md border border-border hover:bg-accent/50 text-muted-foreground transition-colors"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Tareas diferidas */}
            {deferredTasks.length > 0 && (
              <div className="space-y-1.5 pt-1 border-t">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3 h-3 text-muted-foreground/60" />
                  <p className="text-xs text-muted-foreground">Diferidas ({deferredTasks.length})</p>
                </div>
                {deferredTasks.slice(0, 2).map((task) => (
                  <div key={task.id} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="size-1.5 rounded-full bg-muted-foreground/30 shrink-0" />
                    <span className="truncate">{task.title}</span>
                  </div>
                ))}
                {deferredTasks.length > 2 && (
                  <p className="text-xs text-muted-foreground/50">y {deferredTasks.length - 2} más</p>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
