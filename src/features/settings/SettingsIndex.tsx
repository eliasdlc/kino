'use client';

import { Suspense, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import {
  Archive,
  Bell,
  BatteryCharging,
  CalendarClock,
  Keyboard,
  Link2,
  NotebookPen,
  Smartphone,
  Trash2,
  UserRound,
} from 'lucide-react';
import { useEnergyProfile } from '@/features/energy/energy.hooks';
import { useEstadoAvisos, usePushNotifications } from '@/features/notifications/notifications.hooks';
import { useAccount } from '@/features/account/account.hooks';
import { DangerZoneSection } from '@/features/account/DangerZoneSection';
import { EnergyLimitRow } from './EnergyLimitSection';
import { CRONOTIPOS } from './EnergyProfileSection';
import { horaCorta, INTENSIDADES } from './RemindersSection';
import { diaCorto } from './WeeklyReviewDaySection';
import { ThemeRow } from './ThemeRow';
import { TimezoneRow } from './TimezoneSection';
import { CONEXIONES_DESCRIPCION, useConnectionsMeta } from './ConnectionsSection';
import { DATOS_DESCRIPCION } from './DataPortabilitySection';
import { IndexRow, Pendiente, SettingsGroup, SettingsSheet, SheetLoading, SwitchRow } from './settings-ui';
import { useUserSettings } from './settings.hooks';
import { cn } from '@/lib/utils';

/**
 * Lo que cada hoja pinta llega cuando se abre: el índice no carga el panel de
 * Clerk, la papelera ni el manifiesto de la exportación. Mientras llega, la
 * hoja enseña filas del alto real.
 */
function cargando(rows: number) {
  function HojaCargando() {
    return <SheetLoading rows={rows} />;
  }
  return HojaCargando;
}
const EnergyProfileSection = dynamic(() => import('./EnergyProfileSection').then((m) => m.EnergyProfileSection), { loading: cargando(4) });
const RemindersSection = dynamic(() => import('./RemindersSection').then((m) => m.RemindersSection), { loading: cargando(5) });
const WeeklyReviewDaySection = dynamic(() => import('./WeeklyReviewDaySection').then((m) => m.WeeklyReviewDaySection), { loading: cargando(7) });
const ConnectionsSection = dynamic(() => import('./ConnectionsSection').then((m) => m.ConnectionsSection), { loading: cargando(2) });
const ShortcutsSection = dynamic(() => import('./ShortcutsSection').then((m) => m.ShortcutsSection), { loading: cargando(6) });
const DigestsSection = dynamic(() => import('./DigestsSection').then((m) => m.DigestsSection), { loading: cargando(2) });
const DataPortabilitySection = dynamic(() => import('./DataPortabilitySection').then((m) => m.DataPortabilitySection), { loading: cargando(3) });
const TrashSection = dynamic(() => import('./TrashSection').then((m) => m.TrashSection), { loading: cargando(3) });
const AccountSection = dynamic(() => import('@/features/account/AccountSection').then((m) => m.AccountSection), {
  ssr: false,
  loading: cargando(4),
});

export type Hoja =
  | 'energia'
  | 'recordatorios'
  | 'revision'
  | 'cuenta'
  | 'conexiones'
  | 'atajos'
  | 'diario'
  | 'datos'
  | 'papelera';

const glifo = 'size-5 stroke-[1.8]';

/**
 * El regreso del OAuth de GitHub cae en /settings?github=…: la hoja de
 * Conexiones se abre sola para que el resultado se vea donde ocurrió. Va en
 * su propio límite de Suspense porque lee la URL.
 */
function AbrirDesdeLaUrl({ abrir }: { abrir: (hoja: Hoja) => void }) {
  const github = useSearchParams().get('github');
  useEffect(() => {
    if (github) abrir('conexiones');
  }, [github, abrir]);
  return null;
}

/** La meta de los avisos de este dispositivo: el estado del permiso y cuántos hay en la cuenta. */
function metaDispositivo(
  status: ReturnType<typeof usePushNotifications>['status'],
  error: string | null,
  dispositivos: number | undefined,
): string | undefined {
  if (status === 'loading') return 'Comprobando este dispositivo';
  if (status === 'denied') return 'Bloqueados en este navegador';
  if (status === 'unsupported') return 'Este navegador no los admite';
  if (status === 'error') return error ?? 'No se pudo registrar este dispositivo';
  if (dispositivos === undefined) return undefined;
  const cuantos = `${dispositivos} dispositivo${dispositivos === 1 ? '' : 's'}`;
  return status === 'subscribed' ? `Activos en ${cuantos}` : `Apagados aquí; activos en ${cuantos}`;
}

/**
 * Ajustes como índice, en tres grupos por frecuencia: Cada día, Cuenta y Una
 * vez. Lo de un toque se hace en la fila (el tema, el límite, los avisos de
 * este dispositivo); lo demás abre su hoja, que en el teléfono es la hoja
 * inferior y en escritorio el diálogo. Todo guarda al tocar.
 *
 * Cada fila mide lo mismo antes y después de que lleguen sus datos (la meta
 * que falta ocupa su renglón), y `SettingsIndexSkeleton` dibuja las mismas
 * filas para el `loading.tsx`: así la pantalla no salta al cargar.
 */
export function SettingsIndex() {
  const [hoja, setHoja] = useState<Hoja | null>(null);
  const cerrar = (open: boolean) => {
    if (!open) setHoja(null);
  };
  const { data: ajustes } = useUserSettings();
  const { data: perfil } = useEnergyProfile();
  const { data: estado } = useEstadoAvisos();
  const { data: cuenta } = useAccount();
  const push = usePushNotifications();
  const conexiones = useConnectionsMeta();

  const intensidad = ajustes ? INTENSIDADES.find((i) => i.value === ajustes.reminderIntensity)?.label : undefined;
  const cronotipo = perfil ? CRONOTIPOS.find((c) => c.value === perfil.chronotype)?.label : undefined;

  return (
    <div data-slot="settings-index" className="max-w-[40rem] space-y-8 pb-10">
      <Suspense>
        <AbrirDesdeLaUrl abrir={setHoja} />
      </Suspense>

      <SettingsGroup title="Cada día">
        <ThemeRow />
        <EnergyLimitRow />
        <IndexRow
          icon={<BatteryCharging aria-hidden className={glifo} />}
          title="Perfil de energía"
          meta={perfil === null ? 'Sin declarar todavía' : perfil ? `${cronotipo}, duermes ${perfil.sleepTypicalHours} h` : undefined}
          value={perfil === null ? undefined : perfil ? `${perfil.availableHoursPerDay} h` : <Pendiente className="w-8" />}
          onOpen={() => setHoja('energia')}
        />
        <IndexRow
          icon={<Bell aria-hidden className={glifo} />}
          title="Recordatorios"
          meta={
            ajustes
              ? ajustes.notificationsEnabled
                ? `Resumen a las ${horaCorta(ajustes.morningDigestTime)}`
                : 'Apagados en todos tus dispositivos'
              : undefined
          }
          value={ajustes ? (ajustes.notificationsEnabled ? intensidad : 'Apagados') : <Pendiente className="w-12" />}
          onOpen={() => setHoja('recordatorios')}
        />
        <SwitchRow
          icon={<Smartphone aria-hidden className={glifo} />}
          title="Avisos en este dispositivo"
          meta={metaDispositivo(push.status, push.error, estado?.dispositivos)}
          tone={push.status === 'denied' ? 'warn' : undefined}
          checked={push.status === 'subscribed'}
          disabled={push.status === 'loading' || push.status === 'denied' || push.status === 'unsupported'}
          onCheckedChange={(checked) => (checked ? push.subscribe() : push.unsubscribe())}
        />
        <IndexRow
          icon={<CalendarClock aria-hidden className={glifo} />}
          title="Revisión semanal"
          meta="Ese día se reparte lo vencido"
          value={ajustes ? diaCorto(ajustes.weeklyReviewDay) : <Pendiente className="w-8" />}
          onOpen={() => setHoja('revision')}
        />
      </SettingsGroup>

      <SettingsGroup title="Cuenta">
        <IndexRow
          icon={<UserRound aria-hidden className={glifo} />}
          title={cuenta ? cuenta.name : <Pendiente className="h-4 w-32" />}
          meta={cuenta ? cuenta.email : undefined}
          onOpen={() => setHoja('cuenta')}
        />
        <TimezoneRow />
        <IndexRow
          icon={<Link2 aria-hidden className={glifo} />}
          title="Conexiones"
          meta={conexiones}
          onOpen={() => setHoja('conexiones')}
        />
      </SettingsGroup>

      <SettingsGroup title="Una vez">
        <IndexRow
          className="max-md:hidden"
          icon={<Keyboard aria-hidden className={glifo} />}
          title="Atajos de teclado"
          meta="Para moverte sin soltar el teclado"
          onOpen={() => setHoja('atajos')}
        />
        <IndexRow
          icon={<NotebookPen aria-hidden className={glifo} />}
          title="Diario de sesiones"
          meta="Los resúmenes que sube tu laptop"
          onOpen={() => setHoja('diario')}
        />
        <IndexRow
          icon={<Archive aria-hidden className={glifo} />}
          title="Datos y exportación"
          meta="Un ZIP con todo, para llevártelo"
          onOpen={() => setHoja('datos')}
        />
        <IndexRow
          icon={<Trash2 aria-hidden className={glifo} />}
          title="Papelera"
          meta="Lo borrado, hasta que lo restaures"
          onOpen={() => setHoja('papelera')}
        />
        <DangerZoneSection />
      </SettingsGroup>

      <SettingsSheet
        open={hoja === 'energia'}
        onOpenChange={cerrar}
        title="Energía"
        description="Una tarea pesa según su energía: alta 5, media 3, baja 1. Pasar el límite diario trae el aviso de sobregiro y nada se bloquea."
      >
        <EnergyProfileSection />
      </SettingsSheet>
      <SettingsSheet
        open={hoja === 'recordatorios'}
        onOpenChange={cerrar}
        title="Recordatorios"
        description="Cada mañana, un resumen con lo vencido, lo de hoy y lo que se acerca. El día que vence algo, avisos cada vez más seguidos; si se vence, siguen hasta que la termines."
      >
        <RemindersSection />
      </SettingsSheet>
      <SettingsSheet
        open={hoja === 'revision'}
        onOpenChange={cerrar}
        title="Revisión semanal"
        description="El día en que se ofrece repartir lo vencido entre la semana, con la energía de cada día a la vista. Sólo cambia cuándo trabajas cada tarea, nunca su fecha límite."
      >
        <WeeklyReviewDaySection onChosen={() => setHoja(null)} />
      </SettingsSheet>
      <SettingsSheet open={hoja === 'cuenta'} onOpenChange={cerrar} title="Cuenta" description="Nombre, correo, contraseña y sesiones abiertas." wide>
        <AccountSection />
      </SettingsSheet>
      <SettingsSheet open={hoja === 'conexiones'} onOpenChange={cerrar} title="Conexiones" description={CONEXIONES_DESCRIPCION}>
        <ConnectionsSection />
      </SettingsSheet>
      <SettingsSheet open={hoja === 'atajos'} onOpenChange={cerrar} title="Atajos de teclado" description="Para moverte sin soltar el teclado.">
        <ShortcutsSection />
      </SettingsSheet>
      <SettingsSheet
        open={hoja === 'diario'}
        onOpenChange={cerrar}
        title="Diario de sesiones"
        description="El hook de tu laptop sube un resumen de cada sesión de trabajo. Aquí sólo se guarda el resumen; nada crudo sale de tu disco."
      >
        <DigestsSection />
      </SettingsSheet>
      <SettingsSheet open={hoja === 'datos'} onOpenChange={cerrar} title="Datos y exportación" description={DATOS_DESCRIPCION}>
        <DataPortabilitySection />
      </SettingsSheet>
      <SettingsSheet
        open={hoja === 'papelera'}
        onOpenChange={cerrar}
        title="Papelera"
        description="Lo que borraste sigue aquí hasta que lo restaures. Restaurar una carpeta o un capítulo devuelve también lo que se fue con él."
      >
        <TrashSection />
      </SettingsSheet>
    </div>
  );
}

/**
 * El índice esperando, para `loading.tsx`: los mismos tres grupos y el mismo
 * número de filas, cada una del alto que tendrá. Las alturas salen de las
 * mismas clases que las filas reales (título leading-6, meta leading-5 en un
 * renglón), así que el paso del esqueleto a la pantalla no mueve nada.
 */
export function SettingsIndexSkeleton() {
  const fila = (key: string, opts: { alta?: boolean; soloEscritorio?: boolean } = {}) => (
    <div
      key={key}
      className={cn(
        'grid min-h-[3.4rem] grid-cols-[var(--margen)_1fr_auto] items-center border-b border-border last:border-b-0',
        opts.alta && '@container',
        opts.soloEscritorio && 'max-md:hidden',
      )}
    >
      <span className="flex justify-center self-start pt-[0.15rem]">
        <Pendiente className={cn('mt-[0.5rem] size-5 rounded-full', opts.alta && '@min-[20.2rem]:mt-[1.4rem]')} />
      </span>
      <span className="block min-w-0 py-2">
        {opts.alta ? (
          <>
            {/* Las mismas clases que la línea de ThemeRow: cambia de forma en el mismo ancho. */}
            <span className="flex flex-col items-start gap-2 @min-[20.2rem]:flex-row @min-[20.2rem]:items-center @min-[20.2rem]:justify-between @min-[20.2rem]:gap-3">
              <span className="flex h-6 items-center">
                <Pendiente className="h-4 w-12" />
              </span>
              <Pendiente className="h-[3.35rem] w-[13.9rem] rounded-full" />
            </span>
            <span className="mt-1 flex h-5 items-center">
              <Pendiente className="w-48" />
            </span>
          </>
        ) : (
          <>
            <span className="flex h-6 items-center">
              <Pendiente className="h-4 w-32" />
            </span>
            <span className="flex h-5 items-center">
              <Pendiente className="w-40" />
            </span>
          </>
        )}
      </span>
      <span />
    </div>
  );
  const grupo = (titulo: string, filas: React.ReactNode[]) => (
    <section key={titulo}>
      <h2 className="border-b border-ln2 pb-2 font-display text-[1.18rem] font-bold tracking-[-0.02em] text-foreground">{titulo}</h2>
      <div>{filas}</div>
    </section>
  );
  return (
    <div aria-hidden data-slot="settings-index-skeleton" className="max-w-[40rem] space-y-8 pb-10">
      {grupo('Cada día', [
        fila('tema', { alta: true }),
        ...['limite', 'perfil', 'recordatorios', 'avisos', 'revision'].map((k) => fila(k)),
      ])}
      {grupo('Cuenta', ['cuenta', 'zona', 'conexiones'].map((k) => fila(k)))}
      {grupo('Una vez', [
        fila('atajos', { soloEscritorio: true }),
        ...['diario', 'datos', 'papelera', 'borrar'].map((k) => fila(k)),
      ])}
    </div>
  );
}
