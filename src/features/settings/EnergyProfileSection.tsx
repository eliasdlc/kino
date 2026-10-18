'use client';

import { useId } from 'react';
import { BatteryCharging, Clock, Minus, Moon, Plus, Sunrise } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { Segmented } from '@/components/ui/segmented';
import { cn } from '@/lib/utils';
import type { RechargePreset } from '@/features/energy/energy.types';
import { useEnergyProfile } from '@/features/energy/energy.hooks';
import { ControlRow, SheetLoading, Stepper, TrailingRow } from './settings-ui';
import { useBorrador } from './use-borrador';
import { useSaveEnergyProfile } from './settings.hooks';
import { CRONOTIPOS, type Chronotype } from './settings-copy';

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

export const MAX_PRESETS = 8;

const glifo = 'size-5 stroke-[1.8]';

/**
 * Lo que declaras de tu energía, en la hoja de Perfil de energía. Es el punto
 * de partida y no la verdad: lo medido manda sobre lo declarado, y cuando ya
 * hay curva medida la hoja lo dice.
 *
 * Mismo contrato que el resto de Ajustes: cada control guarda al tocarlo, sin
 * botón Guardar. El cronotipo y las pastillas se escriben en el toque; las
 * horas, cuando los toques del stepper paran. La mutación acepta cada campo
 * por separado y deja el valor anterior en el registro.
 */
export function EnergyProfileSection() {
  const { data } = useEnergyProfile();
  const { mutate } = useSaveEnergyProfile();
  const suenoId = useId();
  const horasId = useId();

  const [cronotipo, elegirCronotipo] = useBorrador<Chronotype>(
    data?.chronotype,
    (chronotype, terminado) => mutate({ chronotype }, { onSettled: terminado }),
    0,
  );
  const [sueno, cambiarSueno] = useBorrador(data?.sleepTypicalHours, (sleepTypicalHours, terminado) =>
    mutate({ sleepTypicalHours }, { onSettled: terminado }),
  );
  const [horas, cambiarHoras] = useBorrador(data?.availableHoursPerDay, (availableHoursPerDay, terminado) =>
    mutate({ availableHoursPerDay }, { onSettled: terminado }),
  );
  const [presets, cambiarPresets] = useBorrador(
    data?.rechargePresets as RechargePreset[] | undefined,
    (rechargePresets, terminado) => mutate({ rechargePresets }, { onSettled: terminado }),
    0,
  );

  if (data === null) {
    return (
      <EmptyState
        className="pl-(--margen)"
        title="Todavía no hay perfil de energía."
        description="Sale de las preguntas del alta; cuando lo tengas, aquí se ajusta."
      />
    );
  }
  if (!data || !cronotipo || !presets) return <SheetLoading rows={4} />;

  const elegido = CRONOTIPOS.find((c) => c.value === cronotipo) ?? CRONOTIPOS[1]!;
  const llenos = presets.length >= MAX_PRESETS;

  function alternar(preset: RechargePreset) {
    if (!presets) return;
    const esta = presets.some((p) => p.label === preset.label);
    if (esta) cambiarPresets(presets.filter((p) => p.label !== preset.label));
    else if (!llenos) cambiarPresets([...presets, preset]);
  }

  return (
    <div>
      <p className="pb-3 pl-(--margen) font-voice text-base leading-snug text-body italic">
        {data.hasLearnedCurve
          ? 'Tu curva ya está medida: esto sólo mueve el punto de partida, no lo medido.'
          : 'Lo que declaras aquí es el punto de partida; con el tiempo, lo medido pesa más.'}
      </p>

      <ControlRow icon={<Sunrise aria-hidden className={glifo} />} title="Cuándo rindes más" meta={elegido.desc}>
        <Segmented
          aria-label="Cuándo rindes más"
          value={cronotipo}
          onValueChange={elegirCronotipo}
          options={CRONOTIPOS}
          className="w-full [&>*]:flex-1"
        />
      </ControlRow>

      <TrailingRow icon={<Moon aria-hidden className={glifo} />} title="Cuánto duermes" titleId={suenoId} meta="Mueve tu energía" wrap>
        <Stepper value={sueno} min={4} max={12} onChange={cambiarSueno} labelledBy={suenoId} unit="h" stepLabel="una hora" />
      </TrailingRow>

      <TrailingRow icon={<Clock aria-hidden className={glifo} />} title="Horas para tareas" titleId={horasId} meta="El plan no llena más" wrap>
        <Stepper value={horas} min={1} max={16} onChange={cambiarHoras} labelledBy={horasId} unit="h" stepLabel="una hora" />
      </TrailingRow>

      <ControlRow
        icon={<BatteryCharging aria-hidden className={glifo} />}
        title="Qué te recarga o te gasta"
        meta={`Hasta ${MAX_PRESETS}; cuentan al planificar el día. Llevas ${presets.length}.`}
      >
        {RECHARGE_PRESETS.map((preset) => {
          const esta = presets.some((p) => p.label === preset.label);
          const da = preset.delta > 0;
          return (
            <button
              key={preset.label}
              type="button"
              aria-pressed={esta}
              disabled={!esta && llenos}
              onClick={() => alternar(preset)}
              className={cn(
                'press inline-flex h-[2.85rem] items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold transition-[color,background-color,border-color,transform] duration-(--dur-toque) ease-(--ease-pluma) focus-ring disabled:opacity-50',
                esta ? 'border-foreground bg-foreground text-background' : 'border-ln2 text-body hover:bg-sf2',
              )}
            >
              {da ? <Plus aria-hidden className="size-3.5" /> : <Minus aria-hidden className="size-3.5" />}
              <span className="sr-only">{da ? 'Recarga:' : 'Gasta:'}</span>
              {preset.label}
            </button>
          );
        })}
      </ControlRow>
    </div>
  );
}
