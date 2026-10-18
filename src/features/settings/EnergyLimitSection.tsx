'use client';

import { useId } from 'react';
import { Gauge } from 'lucide-react';
import { Stepper, TrailingRow } from './settings-ui';
import { useBorrador } from './use-borrador';
import { useUpdateUserSettings, useUserSettings } from './settings.hooks';

/** Un paso del límite: lo que pesa una tarea de energía alta. */
export const PASO_LIMITE = 5;
export const LIMITE_MIN = 1;
export const LIMITE_MAX = 500;

/**
 * El límite de energía diario, en línea en el índice. Un toque por paso de
 * cinco puntos (lo que pesa una tarea alta), en vez del campo con su botón
 * Guardar: subir de 50 a 60 son dos toques. Al pasarlo aparece el aviso de
 * sobregiro y nada se bloquea; eso lo explica la hoja de Energía.
 */
export function EnergyLimitRow() {
  const { data } = useUserSettings();
  const { mutate } = useUpdateUserSettings();
  const tituloId = useId();
  const [valor, cambiar] = useBorrador(data?.dailyEnergyLimit, (dailyEnergyLimit, terminado) =>
    mutate({ dailyEnergyLimit }, { onSettled: terminado }),
  );

  return (
    <TrailingRow
      icon={<Gauge aria-hidden className="size-5 stroke-[1.8]" />}
      title="Límite diario"
      titleId={tituloId}
      meta="Puntos por día"
    >
      <Stepper
        value={valor}
        min={LIMITE_MIN}
        max={LIMITE_MAX}
        step={PASO_LIMITE}
        onChange={cambiar}
        labelledBy={tituloId}
        stepLabel={`${PASO_LIMITE} puntos`}
      />
    </TrailingRow>
  );
}
