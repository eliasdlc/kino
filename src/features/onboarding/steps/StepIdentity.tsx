'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ARCHETYPE_LIST, type ArchetypeIdentity } from '../onboarding.archetypes';

interface Props {
  value: ArchetypeIdentity | null;
  onChange: (v: ArchetypeIdentity) => void;
  onNext: () => void;
  onBack: () => void;
}

/**
 * La bifurcación por identidad (D14). Va temprano a propósito: lo que se elija
 * aquí decide el vocabulario del resto del wizard y con qué contenido real sale
 * la persona: no es un selector cosmético de tema.
 */
export function StepIdentity({ value, onChange, onNext, onBack }: Props) {
  return (
    <div className="flex flex-col gap-6 max-w-md mx-auto w-full">
      <div className="space-y-1">
        <h2 className="text-2xl font-bold tracking-tight">¿Quién eres cuando trabajas?</h2>
        <p className="text-muted-foreground">
          Kino habla tu idioma: clases, milestones u obras según a qué te dediques.
        </p>
      </div>

      <div
        role="radiogroup"
        aria-label="Tu identidad de trabajo"
        className="grid gap-3"
      >
        {ARCHETYPE_LIST.map((archetype) => {
          const Icon = archetype.icon;
          const selected = value === archetype.id;
          return (
            <button
              key={archetype.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(archetype.id)}
              className={cn(
                'flex items-start gap-4 p-4 rounded-xl border text-left transition-colors',
                selected
                  ? 'border-primary bg-primary/5'
                  : 'border-border bg-card hover:border-muted-foreground/40',
              )}
            >
              <div
                className={cn(
                  'flex items-center justify-center w-10 h-10 rounded-lg shrink-0',
                  selected ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
                )}
              >
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <p className="font-medium">{archetype.label}</p>
                <p className="text-sm text-muted-foreground">{archetype.tagline}</p>
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex gap-3">
        <Button variant="ghost" onClick={onBack} className="flex-1">
          Atrás
        </Button>
        <Button onClick={onNext} disabled={!value} className="flex-1">
          Siguiente
        </Button>
      </div>
    </div>
  );
}
