'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Segmented } from '@/components/ui/segmented';
import { Slider } from '@/components/ui/slider';
import type { CheckinSlot } from '@/features/energy/energy.schemas';
import { formatHourRange, type SleepQuality } from '@/features/energy/energy.utils';
import { SLOT_LABELS, SLOT_HOURS, SLEEP_LABELS } from './energyDisplay';

const ALL_SLOTS = Object.keys(SLOT_LABELS) as CheckinSlot[];

/** La palabra del tramo y sus horas debajo, en dos renglones que caben en 48 px. */
function SlotLabel({ slot }: { slot: CheckinSlot }) {
  const [start, end] = SLOT_HOURS[slot];
  return (
    <span className="inline-flex flex-col items-center leading-[1.1]">
      {SLOT_LABELS[slot]}
      <span data-slot="slot-hours" className="text-[0.74rem] font-medium tabular-nums">{formatHourRange(start, end)}</span>
    </span>
  );
}

export interface CheckinValues {
  level: number;
  slot: CheckinSlot;
  sleep: SleepQuality;
}

interface EnergyCheckinFormProps {
  defaultLevel: number;
  initialSlot: CheckinSlot;
  /** Los tramos que se pueden registrar ahora; por defecto, los tres. */
  slots?: readonly CheckinSlot[];
  isPending: boolean;
  onSubmit: (values: CheckinValues) => void;
  onCancel: () => void;
}

/**
 * El check-in en la misma página: el tramo y el sueño son segmentos en tinta
 * (elegir es un estado, no una acción), el nivel es la cifra en Bricolage y el
 * acento sobre un deslizador, y Guardar es la única pastilla del acento. Las
 * horas de cada tramo van debajo de su palabra, en el color pleno de la
 * opción y sin opacidad, para que se lean también en la no elegida. Sólo se
 * ofrecen los tramos que ya llegaron: un check-in mide la energía de ahora.
 */
export function EnergyCheckinForm({
  defaultLevel,
  initialSlot,
  slots = ALL_SLOTS,
  isPending,
  onSubmit,
  onCancel,
}: EnergyCheckinFormProps) {
  const [slot, setSlot] = useState<CheckinSlot>(slots.includes(initialSlot) ? initialSlot : slots[slots.length - 1]!);
  const [level, setLevel] = useState(defaultLevel);
  const [sleep, setSleep] = useState<SleepQuality>('good');

  return (
    <div className="space-y-5">
      {/* Sólo los tramos que ya llegaron: con uno solo no hay nada que elegir,
          y el tramo se dice con sus horas, al mismo alto que el segmento. */}
      {slots.length > 1 ? (
        <Segmented
          aria-label="Tramo del día"
          value={slot}
          onValueChange={setSlot}
          className="w-full [&>button]:flex-1"
          options={slots.map((s) => ({ value: s, label: <SlotLabel slot={s} /> }))}
        />
      ) : (
        <p data-slot="tramo-unico" className="flex min-h-[3.35rem] items-center justify-center text-sm font-semibold text-foreground">
          <SlotLabel slot={slot} />
        </p>
      )}

      <div className="space-y-3">
        <div className="flex items-baseline justify-between">
          <p className="font-voice text-[0.98rem] text-body italic">¿Cómo está tu energía?</p>
          <span className="font-display text-2xl font-bold text-primary tabular-nums">{level}</span>
        </div>
        <Slider
          min={1}
          max={100}
          step={1}
          value={[level]}
          onValueChange={([v]) => v !== undefined && setLevel(v)}
          aria-label="Nivel de energía"
          className="w-full"
        />
      </div>

      {slot === 'morning' && (
        <div className="space-y-2">
          <p className="font-voice text-[0.98rem] text-body italic">¿Cómo dormiste?</p>
          <Segmented
            aria-label="Sueño"
            value={sleep}
            onValueChange={setSleep}
            className="w-full [&>button]:flex-1"
            options={(['good', 'partial', 'poor'] as const).map((q) => ({ value: q, label: SLEEP_LABELS[q] ?? q }))}
          />
        </div>
      )}

      <div className="flex gap-2">
        <Button size="lg" onClick={() => onSubmit({ level, slot, sleep })} disabled={isPending} aria-busy={isPending} className="flex-1">
          {isPending ? 'Guardando' : 'Guardar'}
        </Button>
        <Button size="lg" variant="secondary" onClick={onCancel} disabled={isPending}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
