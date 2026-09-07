'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Plus, Minus } from 'lucide-react';

export interface RechargePreset {
  label: string;
  delta: number;
}

interface Props {
  value: RechargePreset[];
  onChange: (v: RechargePreset[]) => void;
  onNext: () => void;
  onBack: () => void;
}

const PRESETS: RechargePreset[] = [
  { label: 'Dormir una siesta', delta: 20 },
  { label: 'Salir a caminar', delta: 15 },
  { label: 'Escuchar música', delta: 10 },
  { label: 'Meditar', delta: 15 },
  { label: 'Comer bien', delta: 10 },
  { label: 'Hablar con alguien', delta: 10 },
  { label: 'Videojuegos', delta: 5 },
  { label: 'Comer te cansa', delta: -10 },
  { label: 'Redes sociales', delta: -5 },
  { label: 'Reuniones largas', delta: -15 },
];

export function StepRecharge({ value, onChange, onNext, onBack }: Props) {
  function toggle(preset: RechargePreset) {
    const exists = value.find((p) => p.label === preset.label);
    if (exists) {
      onChange(value.filter((p) => p.label !== preset.label));
    } else if (value.length < 8) {
      onChange([...value, preset]);
    }
  }

  return (
    <div className="flex flex-col gap-6 max-w-md mx-auto w-full">
      <div className="space-y-1">
        <h2 className="text-2xl font-bold tracking-tight">¿Qué te recarga o te gasta?</h2>
        <p className="text-muted-foreground">
          Selecciona los que apliquen. Kino los considera al planificar.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {PRESETS.map((preset) => {
          const selected = value.find((p) => p.label === preset.label);
          const isPositive = preset.delta > 0;
          return (
            <button
              key={preset.label}
              onClick={() => toggle(preset)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-medium transition-colors',
                selected
                  ? isPositive
                    ? 'bg-green-500/10 border-green-500/50 text-green-600 dark:text-green-400'
                    : 'bg-red-500/10 border-red-500/50 text-red-600 dark:text-red-400'
                  : 'border-border bg-card hover:border-muted-foreground/40 text-muted-foreground',
              )}
            >
              {isPositive ? (
                <Plus className="w-3 h-3" />
              ) : (
                <Minus className="w-3 h-3" />
              )}
              {preset.label}
            </button>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground">
        {value.length === 0 ? 'Ninguno seleccionado: puedes ajustarlo después.' : `${value.length} seleccionado${value.length > 1 ? 's' : ''}`}
      </p>

      <div className="flex gap-3">
        <Button variant="ghost" onClick={onBack} className="flex-1">
          Atrás
        </Button>
        <Button onClick={onNext} className="flex-1">
          Siguiente
        </Button>
      </div>
    </div>
  );
}
