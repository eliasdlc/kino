'use client';

import { Bell, Mail, Moon, Send, Sunrise, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Segmented } from '@/components/ui/segmented';
import { cn } from '@/lib/utils';
import { DIAS_EN_RESUMEN, HORAS_ANTES, VENCIDA_CADA_H, type Intensidad } from '@convex/lib/recordatoriosConstantes';
import { useEstadoAvisos, useProbarAvisos } from '@/features/notifications/notifications.hooks';
import { ControlRow, SheetLoading, SwitchRow } from './settings-ui';
import { useBorrador } from './use-borrador';
import { useUpdateUserSettings, useUserSettings } from './settings.hooks';
import { INTENSIDADES } from './settings-copy';

/**
 * Cuánto y cuándo insisten los recordatorios, en su hoja.
 *
 * Los textos de cada intensidad salen de las mismas constantes con las que el
 * servidor calcula los avisos (`convex/lib/recordatorios.ts`): cambiar una
 * cifra allí cambia lo que se promete aquí, y no pueden contar cosas distintas.
 */

function enumerar(items: string[]): string {
  return items.length <= 1 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} y ${items.at(-1)}`;
}

export function describirIntensidad(i: Intensidad): { antes: string; vencida: string } {
  const horas = HORAS_ANTES[i].filter((h) => h > 0).map(String);
  const cada = VENCIDA_CADA_H[i];
  return {
    antes: `El día que vence: a ${enumerar(horas)} h y a la hora.`,
    vencida: cada === null ? 'Vencida: cada mañana en el resumen.' : `Vencida: cada ${cada} h hasta que la termines.`,
  };
}

/**
 * Un reloj nativo y no el `TimePicker` de la app: en el móvil abre el selector
 * del sistema, y no arrastra la paleta de comandos al chunk de Ajustes.
 *
 * Guarda como el stepper: cada cambio completo se ve al instante y se escribe
 * cuando los cambios paran, y si la hoja se cierra con un cambio pendiente se
 * escribe en ese momento. No espera a que el campo pierda el foco: el selector
 * del teléfono puede cerrar la hoja sin que eso ocurra.
 *
 * El ancho lo pone la hora misma (`w-auto`): "08:00 AM" en en-US y
 * "08:00 a. m." en es-DO caben enteros junto al icono del selector, que con un
 * ancho fijo se comía la última letra. Mide el táctil de la casa, 2.85rem.
 */
function RelojInput({
  value,
  guardar,
  disabled,
  label,
}: {
  value: string;
  guardar: (value: string, terminado: () => void) => void;
  disabled?: boolean;
  label: string;
}) {
  const [hora, cambiar] = useBorrador(value, guardar);
  return (
    <Input
      type="time"
      aria-label={label}
      className="h-[2.85rem] w-auto min-w-[7.5rem] px-3 text-base tabular-nums dark:[color-scheme:dark]"
      value={hora ?? value}
      disabled={disabled}
      onChange={(e) => {
        const next = e.currentTarget.value;
        // Un campo a medio escribir vale "": no se guarda y el reloj vuelve a
        // la última hora completa.
        if (/^\d{2}:\d{2}$/.test(next)) cambiar(next);
      }}
    />
  );
}

function textoEstado(estado: ReturnType<typeof useEstadoAvisos>['data']): string {
  if (estado === undefined) return 'Mirando tus dispositivos';
  if (!estado.pushConfigurado) return 'El push todavía no está configurado en el servidor.';
  if (estado.dispositivos === 0) return 'Ningún dispositivo tiene el push activado. Actívalo en cada uno con «Avisos en este dispositivo».';
  return `Push activado en ${estado.dispositivos} dispositivo${estado.dispositivos === 1 ? '' : 's'}.`;
}

const glifo = 'size-5 stroke-[1.8]';

export function RemindersSection() {
  const { data } = useUserSettings();
  const { mutate } = useUpdateUserSettings();
  const { data: estado } = useEstadoAvisos();
  const { mutate: probar, isPending: probando } = useProbarAvisos();
  const [intensidad, elegirIntensidad] = useBorrador<Intensidad>(
    data?.reminderIntensity,
    (reminderIntensity, terminado) => mutate({ reminderIntensity }, { onSettled: terminado }),
    0,
  );

  if (!data || !intensidad) return <SheetLoading rows={5} />;

  const apagados = !data.notificationsEnabled;
  // Sin correo en el servidor, el interruptor no promete lo que no va a llegar.
  const sinCorreo = estado !== undefined && !estado.correoConfigurado;
  const { antes, vencida } = describirIntensidad(intensidad);

  return (
    <div>
      {/* Interruptor maestro: apagado, ningún cron envía recordatorios a esta
          cuenta, en ningún dispositivo. */}
      <SwitchRow
        icon={<Bell aria-hidden className={glifo} />}
        title="Recibir recordatorios"
        meta={apagados ? 'Apagados: no suena nada en ningún dispositivo' : 'Encendidos en todos tus dispositivos'}
        checked={!apagados}
        wrap
        onCheckedChange={(checked) => mutate({ notificationsEnabled: checked })}
      />

      {/* Con los recordatorios apagados, el resto de la hoja se queda quieto:
          un fieldset desactivado apaga todos sus controles a la vez. */}
      <fieldset disabled={apagados} className={cn('m-0 min-w-0 border-0 p-0', apagados && 'opacity-60')}>
        <ControlRow
          icon={<Volume2 aria-hidden className={glifo} />}
          title="Cuánto insisten"
          meta={
            <>
              <span className="block">{antes}</span>
              <span className="block">{vencida}</span>
            </>
          }
        >
          <Segmented
            aria-label="Cuánto insisten"
            value={intensidad}
            onValueChange={elegirIntensidad}
            options={INTENSIDADES}
            className="w-full [&>*]:flex-1"
          />
        </ControlRow>

        <ControlRow
          icon={<Sunrise aria-hidden className={glifo} />}
          title="Resumen de la mañana"
          meta={`Una tarea crítica aparece desde ${DIAS_EN_RESUMEN.critical} días antes; una alta, desde ${DIAS_EN_RESUMEN.high}; una media, desde ${DIAS_EN_RESUMEN.medium}; una baja, la víspera.`}
        >
          <RelojInput
            value={data.morningDigestTime}
            disabled={apagados}
            label="Hora del resumen"
            guardar={(morningDigestTime, terminado) => mutate({ morningDigestTime }, { onSettled: terminado })}
          />
        </ControlRow>

        <ControlRow
          icon={<Moon aria-hidden className={glifo} />}
          title="Horas de silencio"
          meta="Nada suena en esta franja. Lo que vence de noche o temprano recibe una última llamada una hora antes."
        >
          {/* Desde y hasta en dos renglones alineados: dos relojes y una "a"
              no caben en uno a 393 px, y partidos dejaban la "a" colgando. */}
          <span className="grid grid-cols-[auto_auto] items-center gap-x-3 gap-y-2">
            <span className="text-sm text-muted-foreground">Desde</span>
            <RelojInput
              value={data.quietHoursStart}
              disabled={apagados}
              label="Silencio desde"
              guardar={(quietHoursStart, terminado) => mutate({ quietHoursStart }, { onSettled: terminado })}
            />
            <span className="text-sm text-muted-foreground">Hasta</span>
            <RelojInput
              value={data.quietHoursEnd}
              disabled={apagados}
              label="Silencio hasta"
              guardar={(quietHoursEnd, terminado) => mutate({ quietHoursEnd }, { onSettled: terminado })}
            />
          </span>
        </ControlRow>

        <SwitchRow
          icon={<Mail aria-hidden className={glifo} />}
          title="También por correo"
          meta={
            sinCorreo
              ? 'El correo no está configurado en el servidor: sólo llegan los push.'
              : `El resumen, y lo que no llegue por push, a ${estado?.email ?? 'tu correo'}.`
          }
          checked={data.emailReminders && !sinCorreo}
          disabled={apagados || sinCorreo}
          wrap
          onCheckedChange={(checked) => mutate({ emailReminders: checked })}
        />

        <ControlRow
          icon={<Send aria-hidden className={glifo} />}
          title="Comprobar que llegan"
          // Dos renglones reservados: el estado llega después de la hoja y el
          // más largo ocupa dos en 393 px; así el botón no baja al llegar.
          meta={<span className="block min-h-10">{textoEstado(estado)}</span>}
        >
          <Button variant="outline" disabled={probando || apagados} onClick={() => probar({})}>
            {probando ? 'Enviando la prueba' : 'Enviar una prueba'}
          </Button>
        </ControlRow>
      </fieldset>
    </div>
  );
}
