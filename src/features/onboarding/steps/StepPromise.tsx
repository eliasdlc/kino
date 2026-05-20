'use client';

import { Button } from '@/components/ui/button';
import { Zap, Coffee, ArrowRight, CheckCircle } from 'lucide-react';

interface Props {
  systemName: string;
  onSubmit: () => void;
  onBack: () => void;
  isLoading: boolean;
}

const SAMPLE_PLAN = [
  { title: 'Revisar propuesta del cliente', energy: 'high', priority: 'critical', time: '45 min', startsHere: true },
  { title: 'Escribir informe semanal', energy: 'high', priority: 'high', time: '30 min', startsHere: false },
  { title: '☕ Descanso', energy: null, priority: null, time: '15 min', startsHere: false },
  { title: 'Responder emails pendientes', energy: 'low', priority: 'medium', time: '20 min', startsHere: false },
];

const energyColor: Record<string, string> = {
  high: 'bg-amber-500/20 text-amber-600 dark:text-amber-400',
  low: 'bg-sky-500/20 text-sky-600 dark:text-sky-400',
};

export function StepPromise({ systemName, onSubmit, onBack, isLoading }: Props) {
  return (
    <div className="flex flex-col gap-6 max-w-md mx-auto w-full">
      <div className="space-y-1">
        <h2 className="text-2xl font-bold tracking-tight">Esto verás cada mañana</h2>
        <p className="text-muted-foreground">
          Kino arma tu plan con tus tareas de <strong>{systemName || 'tu sistema'}</strong> e Inbox, ordenadas por lo que más importa y tu energía del momento.
        </p>
      </div>

      <div className="rounded-xl border bg-card p-4 space-y-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Plan de hoy · ejemplo</p>
        {SAMPLE_PLAN.map((item, i) => (
          <div
            key={i}
            className={`flex items-center gap-3 p-3 rounded-lg ${item.startsHere ? 'bg-primary/5 border border-primary/20' : ''}`}
          >
            {item.startsHere ? (
              <Zap className="w-4 h-4 text-primary shrink-0" />
            ) : item.energy === null ? (
              <Coffee className="w-4 h-4 text-muted-foreground shrink-0" />
            ) : (
              <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium truncate ${item.startsHere ? 'text-primary' : ''}`}>
                {item.startsHere && <span className="text-xs text-primary font-semibold mr-1">↗ Empieza aquí</span>}
                {item.title}
              </p>
            </div>
            {item.energy && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${energyColor[item.energy]}`}>
                {item.energy === 'high' ? 'Alta' : 'Baja'}
              </span>
            )}
            <span className="text-xs text-muted-foreground shrink-0">{item.time}</span>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
        <span>Tu plan real usará tus tareas y tu energía del día.</span>
      </div>

      <div className="flex gap-3">
        <Button variant="ghost" onClick={onBack} disabled={isLoading} className="flex-1">
          Atrás
        </Button>
        <Button onClick={onSubmit} disabled={isLoading} className="flex-1">
          {isLoading ? 'Guardando...' : 'Empezar a usar Kino'}
        </Button>
      </div>
    </div>
  );
}
