'use client';

import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Moon } from 'lucide-react';

interface Props {
  value: number;
  onChange: (v: number) => void;
  onNext: () => void;
  onBack: () => void;
}

export function StepSleep({ value, onChange, onNext, onBack }: Props) {
  return (
    <div className="flex flex-col gap-6 max-w-md mx-auto w-full">
      <div className="space-y-1">
        <h2 className="text-2xl font-bold tracking-tight">¿Cuánto sueles dormir?</h2>
        <p className="text-muted-foreground">
          El sueño define la capacidad de energía de tu día.
        </p>
      </div>

      <div className="flex flex-col items-center gap-6 py-4">
        <div className="flex items-center justify-center w-20 h-20 rounded-2xl bg-primary/10">
          <Moon className="w-10 h-10 text-primary" />
        </div>
        <div className="text-center">
          <span className="text-5xl font-bold">{value}</span>
          <span className="text-2xl text-muted-foreground ml-1">h</span>
        </div>
        <Slider
          min={4}
          max={12}
          step={1}
          value={[value]}
          onValueChange={([v]) => onChange(v)}
          className="w-full"
        />
        <div className="flex justify-between w-full text-xs text-muted-foreground">
          <span>4 h</span>
          <span>12 h</span>
        </div>
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
