'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Sunrise, Sun, Moon } from 'lucide-react';

type Chronotype = 'morning' | 'intermediate' | 'evening';

interface Props {
  value: Chronotype;
  onChange: (v: Chronotype) => void;
  onNext: () => void;
  onBack: () => void;
}

const options: { value: Chronotype; label: string; desc: string; icon: React.ElementType }[] = [
  {
    value: 'morning',
    label: 'Mañana',
    desc: 'Rindes mejor antes del mediodía. Después de comer la energía baja.',
    icon: Sunrise,
  },
  {
    value: 'intermediate',
    label: 'Mixto',
    desc: 'Tu energía es bastante estable a lo largo del día.',
    icon: Sun,
  },
  {
    value: 'evening',
    label: 'Noche',
    desc: 'Arrancas lento pero agarras velocidad en la tarde o noche.',
    icon: Moon,
  },
];

export function StepChronotype({ value, onChange, onNext, onBack }: Props) {
  return (
    <div className="flex flex-col gap-6 max-w-md mx-auto w-full">
      <div className="space-y-1">
        <h2 className="text-2xl font-bold tracking-tight">¿Cuándo rindes más?</h2>
        <p className="text-muted-foreground">
          Esto define cuándo Kino te asigna las tareas difíciles.
        </p>
      </div>

      <div className="grid gap-3">
        {options.map((opt) => {
          const Icon = opt.icon;
          return (
            <button
              key={opt.value}
              onClick={() => onChange(opt.value)}
              className={cn(
                'flex items-start gap-4 p-4 rounded-xl border text-left transition-colors',
                value === opt.value
                  ? 'border-primary bg-primary/5'
                  : 'border-border bg-card hover:border-muted-foreground/40',
              )}
            >
              <div
                className={cn(
                  'flex items-center justify-center w-10 h-10 rounded-lg shrink-0',
                  value === opt.value ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
                )}
              >
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <p className="font-medium">{opt.label}</p>
                <p className="text-sm text-muted-foreground">{opt.desc}</p>
              </div>
            </button>
          );
        })}
      </div>

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
