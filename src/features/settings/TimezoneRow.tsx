'use client';

import { useState, useSyncExternalStore } from 'react';
import { Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { IndexRow, SettingsSheet } from './settings-ui';
import { useUpdateUserSettings, useUserSettings } from './settings.hooks';

const nada = () => () => {};

/** La zona del dispositivo. En el servidor no se sabe, y adivinarla rompería la hidratación. */
function useZonaDelDispositivo(): string | null {
  return useSyncExternalStore(
    nada,
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    () => null,
  );
}

/** "America/Santo_Domingo" a "Santo Domingo": la ciudad, que es como se reconoce una zona. */
export function ciudadDe(zona: string): string {
  return (zona.split('/').at(-1) ?? zona).replaceAll('_', ' ');
}

/**
 * Lo que enseña la hoja cuando la zona de la cuenta y la del dispositivo no
 * coinciden: las dos, y el botón para usar la de aquí. Aparte para el catálogo.
 */
export function TimezoneSheetBody({
  cuenta,
  dispositivo,
  cambiando,
  usarLaDeAqui,
}: {
  cuenta: string;
  dispositivo: string;
  cambiando: boolean;
  usarLaDeAqui: () => void;
}) {
  return (
    <>
      <dl className="space-y-3 pb-4 pl-(--margen) text-sm">
        <div>
          <dt className="text-muted-foreground">Tu cuenta</dt>
          <dd className="text-base font-semibold text-foreground">{cuenta}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Este dispositivo</dt>
          <dd className="text-base font-semibold text-foreground">{dispositivo}</dd>
        </div>
      </dl>
      <div className="pl-(--margen)">
        <Button size="lg" disabled={cambiando} onClick={usarLaDeAqui}>
          {cambiando ? 'Cambiando la zona' : 'Usar la de este dispositivo'}
        </Button>
      </div>
    </>
  );
}

/**
 * La zona horaria de la cuenta, que decide a qué hora llegan los avisos de
 * "vence hoy". La ciudad va en la meta: si coincide con la del dispositivo la
 * fila sólo informa, sin chevron; si no, dice las dos y abre una hoja que deja
 * usar la de aquí. No cambia sola: un viaje no debería mover los avisos sin
 * que lo decidas.
 */
export function TimezoneRow() {
  const { data } = useUserSettings();
  const { mutate, isPending } = useUpdateUserSettings();
  const dispositivo = useZonaDelDispositivo();
  const [abierta, setAbierta] = useState(false);

  const cuenta = data?.timezone;
  const listo = cuenta !== undefined && dispositivo !== null;
  const distinta = listo && cuenta !== dispositivo;

  return (
    <>
      <IndexRow
        icon={<Globe aria-hidden className="size-5 stroke-[1.8]" />}
        title="Zona horaria"
        meta={!listo ? undefined : distinta ? `${ciudadDe(cuenta)}; aquí, ${ciudadDe(dispositivo ?? '')}` : `${ciudadDe(cuenta)}, la de aquí`}
        onOpen={distinta ? () => setAbierta(true) : undefined}
      />
      {distinta && dispositivo !== null && (
        <SettingsSheet
          open={abierta}
          onOpenChange={setAbierta}
          title="Zona horaria"
          description="Decide a qué hora llegan los avisos de lo que vence hoy y mañana."
        >
          <TimezoneSheetBody
            cuenta={cuenta}
            dispositivo={dispositivo}
            cambiando={isPending}
            usarLaDeAqui={() => mutate({ timezone: dispositivo }, { onSuccess: () => setAbierta(false) })}
          />
        </SettingsSheet>
      )}
    </>
  );
}
