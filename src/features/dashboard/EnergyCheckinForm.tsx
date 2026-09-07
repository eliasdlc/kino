'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
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

/** Una fila de pills de una sola elección: el elegido es el acento. */
function Choice<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string; hint?: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="flex gap-2" role="radiogroup" aria-label={label}>
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(o.value)}
            className={cn(
              'flex h-[2.8rem] flex-1 flex-col items-center justify-center rounded-full text-sm font-semibold leading-none transition-colors',
              selected ? 'bg-primary text-primary-foreground' : 'bg-secondary text-foreground hover:bg-secondary/70',
            )}
          >
            {o.label}
            {o.hint && <span className={cn('mt-0.5 text-[0.65rem] font-medium', selected ? 'opacity-80' : 'text-muted-foreground')}>{o.hint}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function EnergyCheckinForm({ defaultLevel, initialSlot, isPending, onSubmit, onCancel }: EnergyCheckinFormProps) {
  const [slot, setSlot] = useState<CheckinSlot>(initialSlot);
  const [level, setLevel] = useState(defaultLevel);
  const [sleep, setSleep] = useState<SleepQuality>('good');

  return (
    <div className="space-y-5">
      <Choice
        label="Tramo del día"
        value={slot}
        onChange={setSlot}
        options={(Object.keys(SLOT_LABELS) as CheckinSlot[]).map((s) => {
          const [start, end] = SLOT_HOURS[s];
          return { value: s, label: SLOT_LABELS[s], hint: `${start} a ${end}h` };
        })}
      />

      <div className="space-y-3">
        <div className="flex items-baseline justify-between">
          <p className="text-sm text-foreground/80">¿Cómo está tu energía?</p>
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
          <p className="text-sm text-foreground/80">¿Cómo dormiste?</p>
          <Choice
            label="Sueño"
            value={sleep}
            onChange={setSleep}
            options={(['good', 'partial', 'poor'] as const).map((q) => ({ value: q, label: SLEEP_LABELS[q] ?? q }))}
          />
        </div>
      )}

      <div className="flex gap-2">
        <Button size="lg" onClick={() => onSubmit({ level, slot, sleep })} disabled={isPending} className="flex-1">
          {isPending ? 'Guardando…' : 'Guardar'}
        </Button>
        <Button size="lg" variant="secondary" onClick={onCancel} disabled={isPending}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
