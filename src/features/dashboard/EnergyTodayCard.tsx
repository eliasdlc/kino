'use client';

import { useState } from 'react';
import Link from 'next/link';
import { hourInTimeZone } from '@/shared/time';
import { CalendarDays, ChevronRight, Moon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Segmented } from '@/components/ui/segmented';
import { cn } from '@/lib/utils';
import {
  useTodayCheckins,
  useCreateCheckin,
  useUpdateCheckinAccuracy,
} from '@/features/energy/energy.hooks';
import { findPeakRange } from '@convex/lib/energy/curve';
import { formatHour, CHRONOTYPE_LABELS } from '@/features/energy/energy.utils';
import type { CheckinSlot } from '@/features/energy/energy.schemas';
import type { Chronotype } from '@/features/energy/energy.utils';
import type { TodayCheckinRowTransport } from '@/features/energy/energy.types';
import type { PredictionRow } from '@/features/energy/energy.types';
import { EnergyBudgetBar } from '@/features/energy/EnergyBudgetBar';
import { EnergyChart, type ChartEntry } from './EnergyChart';
import { EnergyCount } from './EnergyCount';
import { EnergyCheckinForm, type CheckinValues } from './EnergyCheckinForm';
import {
  SLOT_LABELS,
  SLEEP_LABELS,
  SLEEP_COLORS,
  getCurrentSlot,
  interpretEnergy,
} from './energyDisplay';

interface EnergyTodayCardProps {
  clock: { hour: number; date: string; timezone: string };
  initialCheckins: TodayCheckinRowTransport[];
  projectedCurve: number[];
  chronotype: Chronotype | null;
  /** Predicciones guardadas de hoy: lo previsto antes de conocer el resultado (4.2). */
  predictions?: PredictionRow[];
}

const SLOT_MIDPOINT: Record<CheckinSlot, number> = { morning: 9, afternoon: 15, evening: 20 };
const SLOT_DE: Record<CheckinSlot, string> = { morning: 'de la mañana', afternoon: 'de la tarde', evening: 'de la noche' };

function buildChartData(curve: number[], checkins: TodayCheckinRowTransport[], timezone: string): ChartEntry[] {
  return Array.from({ length: 24 }, (_, hour) => {
    const checkin = checkins.find((c) => hourInTimeZone(timezone, Date.parse(c.createdAt)) === hour);
    return {
      hour,
      predicted: Math.round(curve[hour] ?? 0),
      actual: checkin ? checkin.currentLevel : null,
    };
  });
}

/** "Domingo, 18 de octubre": la fecha del servidor, con mayúscula inicial. */
function dateLabel(date: string): string {
  const label = new Date(`${date}T12:00:00Z`).toLocaleDateString('es', {
    timeZone: 'UTC',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/**
 * La cota del día. La cifra, en Bricolage 800 y en el acento, comparte
 * renglón con la palabra que la explica (el h1 de la pantalla) y con la frase
 * en la voz, Literata cursiva; debajo, de dónde sale. La curva, el segmento
 * del tramo, el check-in y el presupuesto cuelgan de ella, alineados con la
 * columna de texto del margen. La fecha de arriba es un enlace al calendario
 * y se lee como tal: icono de calendario delante y chevron detrás, en mute,
 * que pasan a tinta al pasar el ratón.
 *
 * El segmento del tramo y el botón dicen lo mismo: elegir "Mañana" cambia la
 * lectura de la cota y el botón pasa a registrar (o actualizar) la mañana.
 */
export function EnergyTodayCard({
  clock,
  initialCheckins,
  projectedCurve,
  chronotype,
  predictions = [],
}: EnergyTodayCardProps) {
  const { data: liveCheckins } = useTodayCheckins();
  const { mutate: createCheckin, isPending } = useCreateCheckin();
  const { mutate: updateAccuracy, isPending: isUpdatingAccuracy } = useUpdateCheckinAccuracy();

  const checkins = liveCheckins ?? initialCheckins;
  const currentHour = clock.hour;
  const currentSlot = getCurrentSlot(currentHour);
  const hasCurve = projectedCurve.length === 24;

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

  const peak = hasCurve ? findPeakRange(projectedCurve) : null;
  const chartData = hasCurve ? buildChartData(projectedCurve, checkins, clock.timezone) : null;

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

  const origin =
    [
      isReal ? 'Registrado' : 'Previsto',
      checkins.length === 0 ? 'sin check-ins hoy' : `${checkins.length} check-in${checkins.length === 1 ? '' : 's'} hoy`,
      chronotype ? `cronotipo ${CHRONOTYPE_LABELS[chronotype]}` : null,
    ]
      .filter(Boolean)
      .join(', ') + '.';

  const word = `${isCurrent ? 'Ahora' : SLOT_LABELS[selectedSlot]}, ${reading.label.toLowerCase()}.`;

  return (
    <div className="flex flex-col gap-4">
      {/* La fecha es la cabecera de la página y la puerta al calendario. */}
      <Link
        href="/calendar"
        className="group/fecha focus-ring -mx-2 inline-flex min-h-[2.85rem] w-fit items-center gap-[0.45em] rounded-full px-2 text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase transition-colors duration-(--dur-toque) ease-(--ease-pluma) hover:text-foreground"
      >
        <CalendarDays data-slot="fecha-icono" className="size-[1.15em] shrink-0" aria-hidden />
        {dateLabel(clock.date)}
        <ChevronRight className="size-[1.15em] shrink-0 transition-transform duration-(--dur-toque) ease-(--ease-pluma) group-hover/fecha:translate-x-[0.15em]" aria-hidden />
      </Link>

      {showForm ? (
        <>
          <h1 className="sr-only">Registrar energía {SLOT_DE[selectedSlot]}</h1>
          <EnergyCheckinForm
            defaultLevel={Math.max(1, slotCheckin?.currentLevel ?? (projectedValue || 70))}
            initialSlot={selectedSlot}
            isPending={isPending}
            onSubmit={handleSubmit}
            onCancel={() => setShowForm(false)}
          />
        </>
      ) : (
        <>
          {/* La cota: cifra y frase en el mismo renglón */}
          <div className="grid grid-cols-[auto_1fr] items-center gap-4">
            <EnergyCount value={heroValue} />
            <div className="min-w-0">
              <h1 className="font-display text-[1.3rem] leading-[1.05] font-bold tracking-[-0.02em] text-foreground">{word}</h1>
              <p className="font-voice mt-1 text-[0.98rem] leading-[1.35] text-body italic">{reading.hint}</p>
              <p className="mt-1.5 text-[0.78rem] text-muted-foreground">{origin}</p>
              {isReal && diff !== null && storedPrediction && (
                <p className="mt-0.5 text-[0.78rem] text-muted-foreground tabular-nums">
                  Previsto {storedPrediction.predictedLevel}, {diff > 0 ? '+' : ''}
                  {diff} frente a lo previsto.
                </p>
              )}
            </div>
          </div>

          {/* La curva del día y su leyenda, en la columna de texto */}
          {chartData && (
            <div className="space-y-1.5 pl-(--margen)">
              <EnergyChart data={chartData} peak={peak} currentHour={currentHour} />
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-[0.74rem] text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-2 rounded-xs bg-primary" aria-hidden />
                  {peak ? `Pico ${formatHour(peak.start)} a ${formatHour(peak.end)}` : 'Tu pico'}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-2 rounded-full border-[1.5px] border-foreground bg-background" aria-hidden />
                  Registrado
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-block h-2.5 w-[3px] rounded-[1px] bg-foreground" aria-hidden />
                  Ahora
                </span>
              </div>
            </div>
          )}

          {/* El check-in en línea: el tramo es un segmento en tinta, el registro una pastilla */}
          <Segmented
            aria-label="Tramo del día"
            value={selectedSlot}
            onValueChange={setSelectedSlot}
            className="w-full [&>button]:flex-1"
            options={(Object.keys(SLOT_LABELS) as CheckinSlot[]).map((slot) => ({
              value: slot,
              label: (
                <span className="inline-flex items-center gap-1.5">
                  {SLOT_LABELS[slot]}
                  {checkins.some((c) => c.slot === slot) && (
                    <>
                      <span className="size-1.5 rounded-full bg-current" aria-hidden />
                      <span className="sr-only">, con check-in</span>
                    </>
                  )}
                </span>
              ),
            }))}
          />

          {/* El botón registra el tramo que se está mirando: si la cota dice
              "Mañana", la etiqueta y lo que se guarda dicen mañana también. */}
          {slotCheckin ? (
            <Button variant="secondary" className="w-full" onClick={() => setShowForm(true)}>
              Actualizar el check-in {SLOT_DE[selectedSlot]}
            </Button>
          ) : (
            <Button size="lg" className="w-full" onClick={() => setShowForm(true)}>
              Registrar energía {SLOT_DE[selectedSlot]}
            </Button>
          )}

          {slotCheckin && selectedSlot === 'morning' && (
            <div className="flex items-center justify-between pl-(--margen)">
              <span className="text-[0.82rem] text-muted-foreground">Sueño</span>
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold',
                  SLEEP_COLORS[slotCheckin.sleepQuality] ?? SLEEP_COLORS.good,
                )}
              >
                <Moon className="size-3" />
                {SLEEP_LABELS[slotCheckin.sleepQuality] ?? slotCheckin.sleepQuality}
              </span>
            </div>
          )}

          {showPredictionFeedback && (
            <div className="space-y-2 border-t border-border pt-3 pl-(--margen)">
              <p className="text-[0.82rem] text-muted-foreground">¿Acertó la predicción de hoy?</p>
              <div className="flex gap-2">
                {[
                  { key: 'accurate' as const, label: 'Sí' },
                  { key: 'partial' as const, label: 'Más o menos' },
                  { key: 'inaccurate' as const, label: 'No' },
                ].map(({ key, label }) => (
                  <Button
                    key={key}
                    variant="secondary"
                    className="flex-1 px-2"
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

      <EnergyBudgetBar className="pt-2 pl-(--margen)" />
    </div>
  );
}
