'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FolderOpen } from 'lucide-react';

interface Props {
  value: string;
  onChange: (v: string) => void;
  onNext: () => void;
  onBack: () => void;
}

const SUGGESTIONS = ['Trabajo', 'Universidad', 'Proyectos personales', 'Salud', 'Finanzas'];

export function StepFirstSystem({ value, onChange, onNext, onBack }: Props) {
  return (
    <div className="flex flex-col gap-6 max-w-md mx-auto w-full">
      <div className="space-y-1">
        <h2 className="text-2xl font-bold tracking-tight">¿Qué área quieres ordenar primero?</h2>
        <p className="text-muted-foreground">
          Un sistema es el espacio donde viven tus tareas de un área de vida. Puedes crear más después.
        </p>
      </div>

      <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mx-auto">
        <FolderOpen className="w-8 h-8 text-primary" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="system-name">Nombre del sistema</Label>
        <Input
          id="system-name"
          placeholder="ej. Trabajo"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          maxLength={100}
          autoFocus
        />
      </div>

      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">Sugerencias</p>
        <div className="flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => onChange(s)}
              className="px-3 py-1 rounded-full border border-border bg-card text-sm hover:border-muted-foreground/40 transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-3">
        <Button variant="ghost" onClick={onBack} className="flex-1">
          Atrás
        </Button>
        <Button onClick={onNext} disabled={!value.trim()} className="flex-1">
          Siguiente
        </Button>
      </div>
    </div>
  );
}
