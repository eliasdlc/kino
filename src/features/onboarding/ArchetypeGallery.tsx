'use client';

import { cn } from '@/lib/utils';
import { SYSTEM_TYPE_CONFIG } from '@/shared/lib/system-types';
import { ARCHETYPE_LIST, type ArchetypeIdentity } from './onboarding.archetypes';

interface ArchetypeGalleryProps {
  value: ArchetypeIdentity;
  onChange: (identity: ArchetypeIdentity) => void;
}

/**
 * La única pregunta del alta: en qué trabajas. Seis filas, una por arquetipo del
 * manifiesto menos Bandeja, que no se elige porque se crea con la cuenta.
 *
 * **Ni una etiqueta se escribe aquí.** El nombre sale de `SYSTEM_TYPE_CONFIG`
 * (`label`) y la línea de abajo de su `vocabulary`, así que añadir un arquetipo
 * es escribir un manifiesto y nunca tocar este archivo. La cobertura la garantiza
 * el tipo de `IDENTITY_BY_SYSTEM_TYPE`: un arquetipo nuevo no compila hasta que
 * tenga su entrada de alta, y entonces su fila aparece sola.
 *
 * La fila entera es la acción: no hay checkbox ni radio dibujado, la elegida se
 * vuelve el acento. Y la lista se desplaza por su cuenta en vez de empujar el
 * botón fuera de la pantalla: con la letra del sistema en grande, seis filas no
 * caben en 852 px, y lo que no puede pasar es que se cronometre el scroll
 * buscando "Entrar".
 */
export function ArchetypeGallery({ value, onChange }: ArchetypeGalleryProps) {
  return (
    <div
      role="radiogroup"
      aria-label="En qué trabajas"
      className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto"
    >
      {ARCHETYPE_LIST.map((archetype) => {
        const manifest = SYSTEM_TYPE_CONFIG[archetype.systemType];
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
              'flex min-h-14 shrink-0 items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors',
              selected
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-card hover:border-muted-foreground/40',
            )}
          >
            <span
              className={cn(
                'grid size-9 shrink-0 place-items-center rounded-md',
                selected ? 'bg-primary-foreground/15' : 'bg-muted text-primary',
              )}
            >
              <Icon className="size-5 stroke-[1.8]" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm leading-tight font-semibold">{manifest.label}</span>
              <span
                className={cn(
                  'block text-xs leading-tight',
                  selected ? 'text-primary-foreground/75' : 'text-muted-foreground',
                )}
              >
                {manifest.vocabulary.join(', ')}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
