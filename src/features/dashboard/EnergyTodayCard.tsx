'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Moon } from 'lucide-react';
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
import type { TodayCheckinRowTransport } from '@/features/energy/energy.types';
import type { PredictionRow } from '@/features/energy/energy.types';
import { EnergyBudgetBar } from '@/features/energy/EnergyBudgetBar';
import { EnergyChart, type ChartEntry } from './EnergyChart';
import { EnergyCheckinForm, type CheckinValues } from './EnergyCheckinForm';
import {
  SLOT_LABELS,
  SLEEP_LABELS,
  SLEEP_COLORS,
  getCurrentSlot,
  interpretEnergy,
} from './energyDisplay';

interface EnergyTodayCardProps {
  initialCheckins: TodayCheckinRowTransport[];
  projectedCurve: number[];
  chronotype: Chronotype | null;
  /** Predicciones guardadas de hoy: lo previsto antes de conocer el resultado (4.2). */
  predictions?: PredictionRow[];
}

const SLOT_MIDPOINT: Record<CheckinSlot, number> = { morning: 9, afternoon: 15, evening: 20 };

function buildChartData(curve: number[], checkins: TodayCheckinRowTransport[]): ChartEntry[] {
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

/** La fecha de hoy en la zona del dispositivo; sólo en cliente para no discrepar con el servidor. */
function useTodayLabel(): string {
  return useSyncExternalStore(
    () => () => {},
    () => new Date().toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' }),
    () => '',
  );
}

/**
 * La cota del día: la cifra de energía a 4.18em compartiendo renglón con la
 * palabra y la frase que la explican, y debajo de dónde sale (previsto o
 * registrado). Es la única cifra de este tamaño en el producto. La curva, el
 * check-in en línea y el presupuesto cuelgan de ella.
 */
export function EnergyTodayCard({
  initialCheckins,
  projectedCurve,
  chronotype,
  predictions = [],
}: EnergyTodayCardProps) {
  const { data: liveCheckins } = useTodayCheckins();
  const { mutate: createCheckin, isPending } = useCreateCheckin();
  const { mutate: updateAccuracy, isPending: isUpdatingAccuracy } = useUpdateCheckinAccuracy();

  const checkins = liveCheckins ?? initialCheckins;
  const currentSlot = getCurrentSlot();
  const currentHour = new Date().getHours();
  const hasCurve = projectedCurve.length === 24;

  const animate = !usePrefersReducedMotion();
  const todayLabel = useTodayLabel();

  const [selectedSlot, setSelectedSlot] = useState<CheckinSlot>(currentSlot);
  const [showForm, setShowForm] = useState(false);

  const isCurrent = selectedSlot === currentSlot;
  const slotCheckin = checkins.find((c) => c.slot === selectedSlot) ?? null;
  const currentSlotCheckin = checkins.find((c) => c.slot === currentSlot) ?? null;

  const readingHour = isCurrent ? currentHour : SLOT_MIDPOINT[selectedSlot];
  const projectedValue = hasCurve ? Math.round(projectedCurve[readingHour] ?? 0) : 0;
  const isReal = slotCheckin !== null;
  const heroValue = isReal ? slotCheckin.currentLevel : projectedValue;
  const reading = interpretEnergy(heroValue);
  const animatedValue = useCountUp(heroValue, animate);

  const peak = hasCurve ? findPeakRange(projectedCurve) : null;
  const chartData = hasCurve ? buildChartData(projectedCurve, checkins) : null;

  // La comparación usa la predicción GUARDADA del slot, no la curva de ahora: la
  // curva ya aprendió de este check-in, así que compararse contra ella sería
  // medirse contra un modelo que vio la respuesta (4.2).
  const storedPrediction = predictions.find((p) => p.slot === selectedSlot) ?? null;
  const diff = isReal && storedPrediction ? slotCheckin.currentLevel - storedPrediction.predictedLevel : null;

  const showPredictionFeedback =
    currentSlotCheckin !== null && currentSlotCheckin.predictionAccuracy === null && hasCurve;

  function handleSubmit({ level, slot, sleep }: CheckinValues) {
    createCheckin(
      { currentLevel: level, slot, ...(slot === 'morning' ? { sleepQuality: sleep } : {}) },
      { onSuccess: () => { setShowForm(false); setSelectedSlot(slot); } },
    );
  }

  const origin = [
    isReal ? 'registrado' : 'previsto',
    `${checkins.length} check-in${checkins.length === 1 ? '' : 's'} hoy`,
    chronotype ? CHRONOTYPE_LABELS[chronotype] : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground first-letter:uppercase">
        {todayLabel}
      </p>

      {showForm ? (
        <EnergyCheckinForm
          defaultLevel={Math.max(1, projectedValue || 70)}
          initialSlot={currentSlot}
          isPending={isPending}
          onSubmit={handleSubmit}
          onCancel={() => setShowForm(false)}
        />
      ) : (
        <>
          {/* La cota: cifra y frase en el mismo renglón */}
          <div className="grid grid-cols-[auto_1fr] items-center gap-4">
            <span
              key={heroValue}
              className="font-display text-[4.18rem] leading-[0.86] font-bold tracking-[-0.03em] text-primary tabular-nums"
            >
              {animatedValue}
            </span>
            <div className="min-w-0">
              <p className="text-[1.06rem] font-bold leading-tight tracking-[-0.01em]">
                {isCurrent ? 'Ahora' : SLOT_LABELS[selectedSlot]} · {reading.label}
              </p>
              <p className="mt-0.5 text-sm text-foreground/80">{reading.hint}</p>
              <p className="mt-1 text-xs text-muted-foreground">{origin}</p>
              {isReal && diff !== null && storedPrediction && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Predije {storedPrediction.predictedLevel} ·{' '}
                  <span className={cn(Math.abs(diff) <= 10 ? 'text-task-done' : 'text-task-overdue')}>
                    {diff > 0 ? '+' : ''}
                    {diff} frente a lo previsto
                  </span>
                </p>
              )}
            </div>
          </div>

          {/* La curva del día y su leyenda */}
          {chartData && (
            <div className="space-y-1.5">
              <EnergyChart data={chartData} peak={peak} currentHour={currentHour} animate={animate} />
              <div className="flex items-center justify-between text-[0.7rem] text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <span className="size-2 rounded-xs bg-primary" aria-hidden />
                  {peak ? `Pico ${formatHourRange(peak.start, peak.end)}` : 'Tu pico'}
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="size-2 rounded-full bg-foreground ring-1 ring-background" aria-hidden />
                  Registrado
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="inline-block w-3 border-t border-dashed border-foreground/60" aria-hidden />
                  Ahora
                </span>
              </div>
            </div>
          )}

          {/* El check-in en línea: el tramo se elige y se registra aquí mismo */}
          <div className="flex gap-2" role="tablist" aria-label="Tramo del día">
            {(Object.keys(SLOT_LABELS) as CheckinSlot[]).map((slot) => {
              const hasCheckin = checkins.some((c) => c.slot === slot);
              const selected = selectedSlot === slot;
              return (
                <button
                  key={slot}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setSelectedSlot(slot)}
                  className={cn(
                    'relative h-[2.8rem] flex-1 rounded-full text-sm font-semibold transition-colors',
                    selected
                      ? 'bg-primary text-primary-foreground shadow-[0_0.5em_1.4em_-0.4em_var(--glow)]'
                      : 'bg-secondary text-foreground hover:bg-secondary/70',
                    slot === currentSlot && !selected && 'ring-1 ring-inset ring-input',
                  )}
                >
                  {SLOT_LABELS[slot]}
                  {hasCheckin && (
                    <span
                      className={cn(
                        'absolute top-2 right-3 size-1.5 rounded-full',
                        selected ? 'bg-primary-foreground' : 'bg-primary',
                      )}
                      aria-label="con check-in"
                    />
                  )}
                </button>
              );
            })}
          </div>

          {currentSlotCheckin ? (
            <Button
              variant="secondary"
              onClick={() => { setSelectedSlot(currentSlot); setShowForm(true); }}
            >
              Actualizar el check-in
            </Button>
          ) : (
            <Button size="lg" onClick={() => { setSelectedSlot(currentSlot); setShowForm(true); }}>
              Registrar energía · {SLOT_LABELS[currentSlot]}
            </Button>
          )}

          {slotCheckin && selectedSlot === 'morning' && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Sueño</span>
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold',
                  SLEEP_COLORS[slotCheckin.sleepQuality] ?? SLEEP_COLORS.good,
                )}
              >
                <Moon className="size-3" />
                {SLEEP_LABELS[slotCheckin.sleepQuality] ?? slotCheckin.sleepQuality}
              </span>
            </div>
          )}

          {showPredictionFeedback && (
            <div className="space-y-2 border-t border-border pt-3">
              <p className="text-xs text-muted-foreground">¿Acertó la predicción de hoy?</p>
              <div className="flex gap-2">
                {[
                  { key: 'accurate' as const, label: 'Sí' },
                  { key: 'partial' as const, label: 'Más o menos' },
                  { key: 'inaccurate' as const, label: 'No' },
                ].map(({ key, label }) => (
                  <Button
                    key={key}
                    size="sm"
                    variant="secondary"
                    className="flex-1"
                    onClick={() => updateAccuracy({ accuracy: key, slot: currentSlot })}
                    disabled={isUpdatingAccuracy}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <EnergyBudgetBar className="pt-2" />
    </div>
  );
}
