'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Segmented } from '@/components/ui/segmented';
import { Slider } from '@/components/ui/slider';
import type { CheckinSlot } from '@/features/energy/energy.schemas';
import type { SleepQuality } from '@/features/energy/energy.utils';
import { SLOT_LABELS, SLOT_HOURS, SLEEP_LABELS } from './energyDisplay';

export interface CheckinValues {
  level: number;
  slot: CheckinSlot;
  sleep: SleepQuality;
}

interface EnergyCheckinFormProps {
  defaultLevel: number;
  initialSlot: CheckinSlot;
  isPending: boolean;
  onSubmit: (values: CheckinValues) => void;
  onCancel: () => void;
}

/**
 * El check-in en la misma página: el tramo y el sueño son segmentos en tinta
 * (elegir es un estado, no una acción), el nivel es la cifra en Bricolage y el
 * acento sobre un deslizador, y Guardar es la única pastilla del acento.
 */
export function EnergyCheckinForm({ defaultLevel, initialSlot, isPending, onSubmit, onCancel }: EnergyCheckinFormProps) {
  const [slot, setSlot] = useState<CheckinSlot>(initialSlot);
  const [level, setLevel] = useState(defaultLevel);
  const [sleep, setSleep] = useState<SleepQuality>('good');

  return (
    <div className="space-y-5">
      <Segmented
        aria-label="Tramo del día"
        value={slot}
        onValueChange={setSlot}
        className="w-full [&>button]:flex-1"
        options={(Object.keys(SLOT_LABELS) as CheckinSlot[]).map((s) => {
          const [start, end] = SLOT_HOURS[s];
          return {
            value: s,
            label: (
              <span className="inline-flex items-baseline gap-1.5">
                {SLOT_LABELS[s]}
                <span className="text-[0.7rem] font-medium opacity-70 tabular-nums">{start} a {end}</span>
              </span>
            ),
          };
        })}
      />

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
