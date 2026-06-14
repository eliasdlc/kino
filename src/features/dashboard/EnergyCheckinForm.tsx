'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import type { CheckinSlot } from '@/features/energy/energy.schemas';
import type { SleepQuality } from '@/features/energy/energy.utils';
import { SLOT_LABELS, SLOT_HOURS, SLEEP_LABELS, levelColor } from './energyDisplay';

export interface CheckinValues {
  level: number;
  slot: CheckinSlot;
  sleep: SleepQuality;
}

interface EnergyCheckinFormProps {
  initialSlot: CheckinSlot;
  isPending: boolean;
  onSubmit: (values: CheckinValues) => void;
  onCancel: () => void;
}

export function EnergyCheckinForm({ initialSlot, isPending, onSubmit, onCancel }: EnergyCheckinFormProps) {
  const [slot, setSlot] = useState<CheckinSlot>(initialSlot);
  const [level, setLevel] = useState(70);
  const [sleep, setSleep] = useState<SleepQuality>('good');

  return (
    <div className="space-y-4">
      <div className="flex gap-1.5">
        {(Object.keys(SLOT_LABELS) as CheckinSlot[]).map((s) => {
          const [start, end] = SLOT_HOURS[s];
          return (
            <button
              key={s}
              onClick={() => setSlot(s)}
              className={cn(
                'flex-1 text-xs py-1 rounded-md border transition-colors',
                slot === s
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border hover:bg-accent/50 text-muted-foreground',
              )}
            >
              {SLOT_LABELS[s]}
              <span className="block text-[10px] opacity-60">{start}–{end}h</span>
            </button>
          );
        })}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">¿Cómo está tu energía? (1–100)</p>
          <span className={cn('text-sm font-bold tabular-nums', levelColor(level))}>{level}</span>
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

      {slot === 'morning' && (
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
      )}

      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={() => onSubmit({ level, slot, sleep })}
          disabled={isPending}
          className="flex-1"
        >
          {isPending ? 'Guardando…' : 'Guardar'}
        </Button>
        <Button size="sm" variant="outline" onClick={onCancel} disabled={isPending}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
