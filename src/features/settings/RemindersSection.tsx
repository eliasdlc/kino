'use client';

import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { DIAS_EN_RESUMEN, HORAS_ANTES, VENCIDA_CADA_H, type Intensidad } from '@convex/lib/recordatoriosConstantes';
import { useEstadoAvisos, useProbarAvisos } from '@/features/notifications/notifications.hooks';
import { useUpdateUserSettings, useUserSettings } from './settings.hooks';

/**
 * Cuánto y cuándo insisten los recordatorios.
 *
 * Los textos de cada intensidad salen de las mismas constantes con las que el
 * servidor calcula los avisos (`convex/lib/recordatorios.ts`): cambiar una
 * cifra allí cambia lo que se promete aquí, y no pueden contar cosas distintas.
 */

const INTENSIDADES: Array<{ value: Intensidad; label: string }> = [
  { value: 'aggressive', label: 'Agresivos' },
  { value: 'medium', label: 'Medios' },
  { value: 'low', label: 'Bajos' },
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

/**
 * Un reloj nativo y no el `TimePicker` de la app: en el móvil abre el selector
 * del sistema, y no arrastra la paleta de comandos al chunk de Ajustes. Guarda
 * al salir del campo, no en cada tecla, para no escribir ajustes a medias.
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
      className="h-9 w-[132px] px-3"
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

/**
 * Una fila de ajuste: título y explicación a la izquierda, el control a la
 * derecha. Sin icono a propósito: cada icono de lucide nuevo pesa en el
 * presupuesto de JavaScript, y aquí el título ya dice lo que es.
 */
function Fila({ titulo, detalle, children }: { titulo: string; detalle: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="min-w-0 flex-1 space-y-0.5">
        <Label className="text-sm font-medium">{titulo}</Label>
        <p className="text-xs text-muted-foreground">{detalle}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">{children}</div>
    </div>
  );
}

function textoEstado(estado: ReturnType<typeof useEstadoAvisos>['data']): string {
  if (estado === undefined) return 'Mirando tus dispositivos…';
  if (!estado.pushConfigurado) return 'El push todavía no está configurado en el servidor.';
  if (estado.dispositivos === 0) return 'Ningún dispositivo tiene el push activado. Actívalo arriba en cada uno.';
  return `Push activado en ${estado.dispositivos} dispositivo${estado.dispositivos === 1 ? '' : 's'}.`;
}

export function RemindersSection() {
  const { data, isLoading } = useUserSettings();
  const { mutate, isPending } = useUpdateUserSettings();
  const { data: estado } = useEstadoAvisos();
  const { mutate: probar, isPending: probando } = useProbarAvisos();
  const apagados = data ? !data.notificationsEnabled : false;
  const bloqueado = isPending || apagados;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Recordatorios</h2>
        <p className="text-sm text-muted-foreground">
          Cada mañana, un resumen con lo vencido, lo de hoy y lo que se acerca. El día que vence algo, avisos cada vez más
          seguidos. Y si se vence, siguen hasta que la termines.
        </p>
      </div>

      {isLoading || !data ? (
        <Skeleton className="h-40 w-full rounded-lg" />
      ) : (
        <div className={cn('space-y-4', apagados && 'opacity-60')}>
          <div role="radiogroup" aria-label="Cuánto insisten" className="grid gap-2 sm:grid-cols-3">
            {INTENSIDADES.map(({ value, label }) => {
              const elegida = data.reminderIntensity === value;
              const { antes, vencida } = describirIntensidad(value);
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={elegida}
                  disabled={bloqueado}
                  onClick={() => mutate({ reminderIntensity: value })}
                  className={cn(
                    'rounded-lg border p-3 text-left transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    elegida && 'border-primary bg-primary/5',
                  )}
                >
                  <span className="text-sm font-medium">{label}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">{antes}</span>
                  <span className="block text-xs text-muted-foreground">{vencida}</span>
                </button>
              );
            })}
          </div>

          <Fila
            titulo="Resumen de la mañana"
            detalle={`Una tarea crítica aparece desde ${DIAS_EN_RESUMEN.critical} días antes; una alta, desde ${DIAS_EN_RESUMEN.high}; una media, desde ${DIAS_EN_RESUMEN.medium}; una baja, la víspera.`}
          >
            <RelojInput
              value={data.morningDigestTime}
              disabled={bloqueado}
              label="Hora del resumen"
              onChange={(value) => mutate({ morningDigestTime: value })}
            />
          </Fila>

          <Fila
            titulo="Horas de silencio"
            detalle="Nada suena en esta franja. Lo que vence de noche o temprano recibe una última llamada una hora antes."
          >
            <RelojInput
              value={data.quietHoursStart}
              disabled={bloqueado}
              label="Silencio desde"
              onChange={(value) => mutate({ quietHoursStart: value })}
            />
            <span className="text-xs text-muted-foreground">a</span>
            <RelojInput
              value={data.quietHoursEnd}
              disabled={bloqueado}
              label="Silencio hasta"
              onChange={(value) => mutate({ quietHoursEnd: value })}
            />
          </Fila>

          <Fila
            titulo="También por correo"
            detalle={
              estado && !estado.correoConfigurado
                ? 'El correo todavía no está configurado en el servidor: por ahora sólo llegan los push.'
                : `El resumen de cada mañana, y cualquier aviso que no llegue por push, a ${estado?.email ?? 'tu correo'}.`
            }
          >
            <Switch
              checked={data.emailReminders}
              disabled={bloqueado}
              onCheckedChange={(checked) => mutate({ emailReminders: checked })}
            />
          </Fila>

          <Fila titulo="Comprobar que llegan" detalle={textoEstado(estado)}>
            <Button variant="outline" size="sm" disabled={probando || apagados} onClick={() => probar({})}>
              {probando ? 'Enviando…' : 'Enviar una prueba'}
            </Button>
          </Fila>
        </div>
      )}
    </div>
  );
}
