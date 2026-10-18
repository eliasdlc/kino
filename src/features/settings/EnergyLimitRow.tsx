'use client';

import { useId } from 'react';
import { Gauge } from 'lucide-react';
import { Stepper, TrailingRow } from './settings-ui';
import { useBorrador } from './use-borrador';
import { useUpdateUserSettings, useUserSettings } from './settings.hooks';
import { META_LIMITE } from './settings-copy';

/** Un paso del límite: lo que pesa una tarea de energía alta. */
export const PASO_LIMITE = 5;
export const LIMITE_MIN = 1;
export const LIMITE_MAX = 500;

/**
 * El límite de energía diario, en línea en el índice. Un toque por paso de
 * cinco puntos (lo que pesa una tarea alta), en vez del campo con su botón
 * Guardar: subir de 50 a 60 son dos toques. Los pasos caen en la rejilla de
 * cinco: desde 47, + da 50 y - da 45; el mínimo 1 se sale de ella y el primer
 * toque lo devuelve (de 1, + da 5). La meta dice qué es un punto, porque es
 * aquí donde se ajusta, y su texto no espera datos: el esqueleto la pinta
 * igual, aunque ocupe dos renglones.
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
      meta={META_LIMITE}
      wrap
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
