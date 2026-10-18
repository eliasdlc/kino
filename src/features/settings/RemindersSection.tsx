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

/**
 * Cuánto y cuándo insisten los recordatorios, en su hoja.
 *
 * Los textos de cada intensidad salen de las mismas constantes con las que el
 * servidor calcula los avisos (`convex/lib/recordatorios.ts`): cambiar una
 * cifra allí cambia lo que se promete aquí, y no pueden contar cosas distintas.
 */

export const INTENSIDADES: ReadonlyArray<{ value: Intensidad; label: string }> = [
  { value: 'low', label: 'Bajos' },
  { value: 'medium', label: 'Medios' },
  { value: 'aggressive', label: 'Agresivos' },
];

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

/** "08:00" a "8:00" y "22:00" a "22": la hora como se dice, para la meta del índice. */
export function horaCorta(hhmm: string, conMinutos = true): string {
  const [h, m] = hhmm.split(':');
  const hora = String(Number(h));
  if (m === '00' && !conMinutos) return hora;
  return `${hora}:${m}`;
}

/**
 * Un reloj nativo y no el `TimePicker` de la app: en el móvil abre el selector
 * del sistema, y no arrastra la paleta de comandos al chunk de Ajustes. Guarda
 * al salir del campo, no en cada tecla, para no escribir ajustes a medias.
 * Mide el táctil de la casa, 2.85rem.
 */
function RelojInput({
  value,
  onChange,
  disabled,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <Input
      type="time"
      aria-label={label}
      className="h-[2.85rem] w-[8rem] px-3 text-base tabular-nums dark:[color-scheme:dark]"
      defaultValue={value}
      key={value}
      disabled={disabled}
      onBlur={(e) => {
        const next = e.currentTarget.value;
        if (/^\d{2}:\d{2}$/.test(next) && next !== value) onChange(next);
      }}
    />
  );
}

function textoEstado(estado: ReturnType<typeof useEstadoAvisos>['data']): string {
  if (estado === undefined) return 'Mirando tus dispositivos';
  if (!estado.pushConfigurado) return 'El push todavía no está configurado en el servidor.';
  if (estado.dispositivos === 0) return 'Ningún dispositivo tiene el push activado. Actívalo en cada uno desde Ajustes.';
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
            onChange={(value) => mutate({ morningDigestTime: value })}
          />
        </ControlRow>

        <ControlRow
          icon={<Moon aria-hidden className={glifo} />}
          title="Horas de silencio"
          meta="Nada suena en esta franja. Lo que vence de noche o temprano recibe una última llamada una hora antes."
        >
          <RelojInput
            value={data.quietHoursStart}
            disabled={apagados}
            label="Silencio desde"
            onChange={(value) => mutate({ quietHoursStart: value })}
          />
          <span className="text-sm text-muted-foreground">a</span>
          <RelojInput
            value={data.quietHoursEnd}
            disabled={apagados}
            label="Silencio hasta"
            onChange={(value) => mutate({ quietHoursEnd: value })}
          />
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

        <ControlRow icon={<Send aria-hidden className={glifo} />} title="Comprobar que llegan" meta={textoEstado(estado)}>
          <Button variant="outline" disabled={probando || apagados} onClick={() => probar({})}>
            {probando ? 'Enviando la prueba' : 'Enviar una prueba'}
          </Button>
        </ControlRow>
      </fieldset>
    </div>
  );
}
