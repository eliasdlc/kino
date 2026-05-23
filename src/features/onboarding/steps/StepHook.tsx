'use client';

import { Button } from '@/components/ui/button';
import { Zap, Calendar, Brain } from 'lucide-react';

interface Props {
  onNext: () => void;
}

export function StepHook({ onNext }: Props) {
  return (
    <div className="flex flex-col items-center text-center gap-8 max-w-md mx-auto">
      <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10">
        <Zap className="w-8 h-8 text-primary" />
      </div>

      <div className="space-y-3">
        <h1 className="text-3xl font-bold tracking-tight">
          Kino arma tu día según tu energía
        </h1>
        <p className="text-muted-foreground text-lg leading-relaxed">
          No solo tu lista de tareas — la app propone qué hacer, en qué orden,
          y cuándo descansar para que puedas trabajar sin quemarte.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 w-full text-left">
        <div className="flex gap-4 p-4 rounded-xl border bg-card">
          <Brain className="w-5 h-5 text-primary mt-0.5 shrink-0" />
          <div>
            <p className="font-medium text-sm">Plan del día en segundos</p>
            <p className="text-muted-foreground text-sm">
              Tus tareas ordenadas por importancia y energía disponible.
            </p>
          </div>
        </div>
        <div className="flex gap-4 p-4 rounded-xl border bg-card">
          <Calendar className="w-5 h-5 text-primary mt-0.5 shrink-0" />
          <div>
            <p className="font-medium text-sm">Nada se pierde en el backlog</p>
            <p className="text-muted-foreground text-sm">
              Lo urgente sube solo. Lo importante no desaparece.
            </p>
          </div>
        </div>
      </div>

      <Button size="lg" onClick={onNext} className="w-full">
        Empezar — tarda 2 minutos
      </Button>
    </div>
  );
}
