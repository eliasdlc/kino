'use client';

import { useState } from 'react';
import { Clock, Minus, Moon, Plus, Sun, Sunrise } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import type { RechargePreset } from '@/features/energy/energy.types';
import { useEnergyProfile, useUpdateEnergyProfile } from '@/features/energy/energy.hooks';

type Chronotype = 'morning' | 'intermediate' | 'evening';

const CHRONOTYPES: { value: Chronotype; label: string; desc: string; icon: React.ElementType }[] = [
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

const RECHARGE_PRESETS: RechargePreset[] = [
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

const MAX_PRESETS = 8;

interface Draft {
  chronotype: Chronotype;
  sleepTypicalHours: number;
  availableHoursPerDay: number;
  rechargePresets: RechargePreset[];
}

/**
 * Lo que declaras de tu energía. Vive aquí, y no en el alta, porque un perfil
 * escrito el día 1 es una suposición: Kino mide y estos cuatro son la hipótesis
 * de partida, no la verdad. Cuando ya hay curva medida, la sección lo dice, y el
 * momento en que el producto vuelve a preguntar el cronotipo con esa curva
 * delante lo decide el motor de energía a los catorce días.
 *
 * Se guarda lo que se toca: la mutación acepta los cuatro campos por separado.
 */
export function EnergyProfileSection() {
  const { data, isLoading } = useEnergyProfile();
  const { mutate, isPending } = useUpdateEnergyProfile();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [synced, setSynced] = useState<unknown>(null);

  // Igual que el límite de energía: el borrador se sincroniza durante el render
  // cuando llega o cambia el servidor, en vez de con un efecto.
  if (data && data !== synced) {
    setSynced(data);
    setDraft({
      chronotype: data.chronotype,
      sleepTypicalHours: data.sleepTypicalHours,
      availableHoursPerDay: data.availableHoursPerDay,
      rechargePresets: data.rechargePresets as RechargePreset[],
    });
  }

  function togglePreset(preset: RechargePreset) {
    setDraft((current) => {
      if (!current) return current;
      const chosen = current.rechargePresets.some((p) => p.label === preset.label);
      if (chosen) {
        return {
          ...current,
          rechargePresets: current.rechargePresets.filter((p) => p.label !== preset.label),
        };
      }
      if (current.rechargePresets.length >= MAX_PRESETS) return current;
      return { ...current, rechargePresets: [...current.rechargePresets, preset] };
    });
  }

  const dirty =
    data != null &&
    draft != null &&
    (draft.chronotype !== data.chronotype ||
      draft.sleepTypicalHours !== data.sleepTypicalHours ||
      draft.availableHoursPerDay !== data.availableHoursPerDay ||
      JSON.stringify(draft.rechargePresets) !== JSON.stringify(data.rechargePresets));

  function save() {
    if (!draft || !dirty) return;
    mutate(draft);
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Tu perfil de energía</h2>
        <p className="text-sm text-muted-foreground">
          Lo que declaras de ti. Es la hipótesis con la que Kino arranca, no la última
          palabra: lo que mide manda sobre lo que dices.
        </p>
      </div>

      {isLoading || !draft ? (
        <Skeleton className="h-[22rem] w-full rounded-lg" />
      ) : (
        <>
          {data?.hasLearnedCurve && (
            <p className="rounded-lg border border-border bg-card px-4 py-3 text-xs text-muted-foreground">
              Kino ya tiene tu curva medida. Cambiar esto mueve la hipótesis, no lo que
              midió.
            </p>
          )}

          <fieldset className="space-y-2 rounded-lg border p-4">
            <legend className="px-1 text-sm font-medium">Cuándo rindes más</legend>
            <p className="text-xs text-muted-foreground">
              Define cuándo Kino te propone las tareas difíciles.
            </p>
            <div className="grid gap-2 pt-1" role="radiogroup" aria-label="Cuándo rindes más">
              {CHRONOTYPES.map((option) => {
                const Icon = option.icon;
                const selected = draft.chronotype === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setDraft({ ...draft, chronotype: option.value })}
                    className={cn(
                      'flex min-h-14 items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors',
                      selected
                        ? 'border-primary bg-primary/5'
                        : 'border-border bg-card hover:border-muted-foreground/40',
                    )}
                  >
                    <span
                      className={cn(
                        'grid size-9 shrink-0 place-items-center rounded-md',
                        selected ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
                      )}
                    >
                      <Icon className="size-5 stroke-[1.8]" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{option.label}</span>
                      <span className="block text-xs text-muted-foreground">{option.desc}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="grid gap-4 rounded-lg border p-4 sm:grid-cols-2">
            <HoursField
              id="sleep-hours"
              icon={Moon}
              label="Cuánto sueles dormir"
              hint="El sueño define la capacidad de energía de tu día."
              min={4}
              max={12}
              value={draft.sleepTypicalHours}
              onChange={(sleepTypicalHours) => setDraft({ ...draft, sleepTypicalHours })}
            />
            <HoursField
              id="available-hours"
              icon={Clock}
              label="Cuántas horas tienes al día"
              hint="El plan no llena más de este tiempo con tareas."
              min={1}
              max={16}
              value={draft.availableHoursPerDay}
              onChange={(availableHoursPerDay) => setDraft({ ...draft, availableHoursPerDay })}
            />
          </div>

          <fieldset className="space-y-2 rounded-lg border p-4">
            <legend className="px-1 text-sm font-medium">Qué te recarga o te gasta</legend>
            <p className="text-xs text-muted-foreground">
              Hasta {MAX_PRESETS}. Kino los considera al planificar.
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              {RECHARGE_PRESETS.map((preset) => {
                const chosen = draft.rechargePresets.some((p) => p.label === preset.label);
                const gives = preset.delta > 0;
                return (
                  <button
                    key={preset.label}
                    type="button"
                    aria-pressed={chosen}
                    onClick={() => togglePreset(preset)}
                    className={cn(
                      'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
                      chosen
                        ? gives
                          ? 'border-task-done/50 bg-task-done/10 text-task-done'
                          : 'border-task-overdue/50 bg-task-overdue/10 text-task-overdue'
                        : 'border-border bg-card text-muted-foreground hover:border-muted-foreground/40',
                    )}
                  >
                    {gives ? <Plus className="size-3" /> : <Minus className="size-3" />}
                    {preset.label}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <Button onClick={save} disabled={!dirty || isPending}>
            {isPending ? 'Guardando…' : 'Guardar'}
          </Button>
        </>
      )}
    </div>
  );
}

/** Un número de horas con su deslizador. Los dos campos son la misma pieza. */
function HoursField({
  id,
  icon: Icon,
  label,
  hint,
  min,
  max,
  value,
  onChange,
}: {
  id: string;
  icon: React.ElementType;
  label: string;
  hint: string;
  min: number;
  max: number;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Icon className="size-4 shrink-0 text-muted-foreground" />
        <Label htmlFor={id} className="text-sm font-medium">
          {label}
        </Label>
        <span className="ml-auto font-display text-xl font-bold tabular-nums">
          {value}
          <span className="ml-0.5 text-sm font-normal text-muted-foreground">h</span>
        </span>
      </div>
      <Slider
        id={id}
        min={min}
        max={max}
        step={1}
        value={[value]}
        onValueChange={([next]) => onChange(next)}
        aria-label={label}
      />
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}
