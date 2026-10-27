'use client';

import { Check } from 'lucide-react';
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
 * Son filas de margen, sin card: el icono del arquetipo en el margen, el
 * nombre y sus sustantivos en la columna de texto, y la marca a la derecha. La
 * fila entera es la acción; la elegida se dice en tinta (el círculo relleno y
 * el nombre en 700), porque elegir es un estado y el ámbar queda para Entrar.
 * Y la lista se desplaza por su cuenta en vez de empujar el botón fuera de la
 * pantalla: con la letra del sistema en grande, seis filas no caben en 852 px,
 * y lo que no puede pasar es que se cronometre el scroll buscando "Entrar".
 */
export function ArchetypeGallery({ value, onChange }: ArchetypeGalleryProps) {
  return (
    <div
      role="radiogroup"
      aria-label="En qué trabajas"
      className="flex min-h-0 flex-1 flex-col overflow-y-auto"
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
              'press focus-ring grid min-h-[3.6rem] shrink-0 grid-cols-[var(--margen)_1fr_auto] items-center border-b border-border text-left transition-[background-color,transform] duration-(--dur-toque) ease-(--ease-pluma) last:border-b-0',
              selected ? 'bg-sf2/70' : 'hover:bg-sf2/50',
            )}
          >
            <span className={cn('flex justify-center', selected ? 'text-foreground' : 'text-muted-foreground')}>
              <Icon className="size-5 stroke-[1.8]" aria-hidden />
            </span>
            <span className="min-w-0 py-2.5">
              <span className={cn('block leading-tight text-foreground', selected ? 'font-bold' : 'font-semibold')}>
                {manifest.label}
              </span>
              <span className="mt-0.5 block text-sm leading-tight text-muted-foreground">
                {manifest.vocabulary.join(', ')}
              </span>
            </span>
            <span
              aria-hidden
              className={cn(
                'mr-1 ml-2.5 flex size-[1.35rem] items-center justify-center rounded-full border-[1.6px] transition-[background-color,border-color] duration-(--dur-toque) ease-(--ease-pluma)',
                selected ? 'border-foreground bg-foreground text-background' : 'border-input',
              )}
            >
              {selected && <Check className="size-3" strokeWidth={3} />}
            </span>
          </button>
        );
      })}
    </div>
  );
}
