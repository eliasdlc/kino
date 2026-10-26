'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Archive,
  Bot,
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
import { EnergyLimitRow } from './EnergyLimitRow';
import { ThemeRow } from './ThemeRow';
import { TimezoneRow } from './TimezoneRow';
import { IndexRow, Pendiente, SettingsGroup, SettingsSheet, SheetLoading, SwitchRow, TITULO_GRUPO } from './settings-ui';
import {
  AGENTES_DESCRIPCION,
  ALTO_CUENTA,
  CONEXIONES_DESCRIPCION,
  CRONOTIPOS,
  DATOS_DESCRIPCION,
  diaCorto,
  horaCorta,
  INTENSIDADES,
  META_LIMITE,
  PESO_ENERGIA,
} from './settings-copy';
import { useConnectionsMeta, useUserSettings } from './settings.hooks';
import { cn } from '@/lib/utils';

/**
 * Lo que cada hoja pinta llega cuando se abre: el índice no importa ninguna
 * hoja de forma estática (lo que necesita saber de ellas vive en
 * `settings-copy.ts`), así que el panel de Clerk, la papelera, el manifiesto
 * de la exportación y el panel de GitHub salen del chunk de /settings. Apuntar
 * o enfocar una fila trae su código antes del toque; mientras llega, la hoja
 * enseña filas del alto real.
 */
const cargar = {
  energia: () => import('./EnergyProfileSection'),
  recordatorios: () => import('./RemindersSection'),
  revision: () => import('./WeeklyReviewDaySection'),
  cuenta: () => import('@/features/account/AccountSection'),
  conexiones: () => import('./ConnectionsSection'),
  agentes: () => import('./AgentsSection'),
  atajos: () => import('./ShortcutsSection'),
  diario: () => import('./DigestsSection'),
  datos: () => import('./DataPortabilitySection'),
  papelera: () => import('./TrashSection'),
};

function cargando(rows: number, className?: string) {
  function HojaCargando() {
    return <SheetLoading rows={rows} className={className} />;
  }
  return HojaCargando;
}
const EnergyProfileSection = dynamic(() => cargar.energia().then((m) => m.EnergyProfileSection), { loading: cargando(4) });
const RemindersSection = dynamic(() => cargar.recordatorios().then((m) => m.RemindersSection), { loading: cargando(5) });
const WeeklyReviewDaySection = dynamic(() => cargar.revision().then((m) => m.WeeklyReviewDaySection), { loading: cargando(7) });
const ConnectionsSection = dynamic(() => cargar.conexiones().then((m) => m.ConnectionsSection), { loading: cargando(2) });
const AgentsSection = dynamic(() => cargar.agentes().then((m) => m.AgentsSection), { loading: cargando(4) });
const ShortcutsSection = dynamic(() => cargar.atajos().then((m) => m.ShortcutsSection), { loading: cargando(6) });
const DigestsSection = dynamic(() => cargar.diario().then((m) => m.DigestsSection), { loading: cargando(2) });
const DataPortabilitySection = dynamic(() => cargar.datos().then((m) => m.DataPortabilitySection), { loading: cargando(3) });
const TrashSection = dynamic(() => cargar.papelera().then((m) => m.TrashSection), { loading: cargando(3) });
const AccountSection = dynamic(() => cargar.cuenta().then((m) => m.AccountSection), {
  ssr: false,
  // El alto del panel de Clerk: la hoja no crece cuando llega.
  loading: cargando(4, ALTO_CUENTA),
});

export type Hoja = keyof typeof cargar | 'avisos';

const glifo = 'size-5 stroke-[1.8]';

/** Abrir una hoja desde su fila, y traer su código al apuntarla. */
type Abrir = (hoja: Hoja) => void;
const precargar = (hoja: keyof typeof cargar) => () => void cargar[hoja]();

/**
 * El regreso del OAuth de GitHub cae en /settings?github=…: la hoja de
 * Conexiones se abre sola para que el resultado se vea donde ocurrió. Al
 * cerrarla, la URL deja de decir `?github=`: si no, un refresco volvería a
 * abrir la hoja y a avisar del OAuth. Se limpia al cerrar y no al abrir porque
 * el panel de GitHub lee el resultado de ahí mientras está a la vista. Es el
 * único que lee la URL y va en su propio límite de Suspense, para que el resto
 * del índice se pinte sin esperarla; registra con `alCerrar` lo que hace el cierre.
 */
function RegresoDeGithub({ abrir, alCerrar }: { abrir: Abrir; alCerrar: (limpiar: () => void) => void }) {
  const router = useRouter();
  const github = useSearchParams().get('github');
  useEffect(() => {
    if (github) abrir('conexiones');
  }, [github, abrir]);
  useEffect(() => {
    alCerrar(() => {
      if (github !== null) router.replace('/settings', { scroll: false });
    });
  }, [github, alCerrar, router]);
  return null;
}

/** La meta de los avisos de este dispositivo: el estado del permiso y cuántos hay en la cuenta. */
function metaDispositivo(
  status: ReturnType<typeof usePushNotifications>['status'],
  error: string | null,
  dispositivos: number | undefined,
): string | undefined {
  if (status === 'loading') return 'Comprobando este dispositivo';
  if (status === 'unsupported') return 'Este navegador no los admite';
  if (status === 'error') return error ?? 'No se pudo registrar este dispositivo';
  if (dispositivos === undefined) return undefined;
  const cuantos = `${dispositivos} dispositivo${dispositivos === 1 ? '' : 's'}`;
  return status === 'subscribed' ? `Activos en ${cuantos}` : `Apagados aquí; activos en ${cuantos}`;
}

/** Cómo devolverle el permiso al navegador: tres pasos, numerados en el margen. */
export function AvisosBloqueadosBody() {
  return (
    <ol className="list-decimal space-y-2 pb-2 pl-[calc(var(--margen)+1rem)] text-base leading-snug text-body marker:text-muted-foreground">
      <li>Toca el candado o el icono de ajustes junto a la dirección de la página.</li>
      <li>En Notificaciones, elige Permitir.</li>
      <li>Recarga la página y enciende Avisos en este dispositivo.</li>
    </ol>
  );
}

/*
 * Las filas que leen datos se suscriben a lo suyo: un cambio en los avisos
 * re-pinta su fila, no la página entera con sus diez hojas.
 */

function EnergyProfileRow({ abrir }: { abrir: Abrir }) {
  const { data: perfil } = useEnergyProfile();
  const cronotipo = perfil ? CRONOTIPOS.find((c) => c.value === perfil.chronotype)?.label : undefined;
  return (
    <IndexRow
      icon={<BatteryCharging aria-hidden className={glifo} />}
      title="Perfil de energía"
      meta={perfil === null ? 'Sin declarar todavía' : perfil ? `${cronotipo}, ${perfil.availableHoursPerDay} h para tareas` : undefined}
      onOpen={() => abrir('energia')}
      onPrefetch={precargar('energia')}
    />
  );
}

function RemindersRow({ abrir }: { abrir: Abrir }) {
  const { data: ajustes } = useUserSettings();
  const intensidad = ajustes ? INTENSIDADES.find((i) => i.value === ajustes.reminderIntensity)?.label : undefined;
  return (
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
      onOpen={() => abrir('recordatorios')}
      onPrefetch={precargar('recordatorios')}
    />
  );
}

/**
 * Los avisos de este dispositivo. Con el permiso bloqueado el interruptor no
 * puede hacer nada, así que la fila cambia a una que abre cómo desbloquearlo:
 * mismo alto, la palabra de estado en coral y el chevron.
 */
function DeviceNotificationsRow({ abrir }: { abrir: Abrir }) {
  const push = usePushNotifications();
  const { data: estado } = useEstadoAvisos();
  const icono = <Smartphone aria-hidden className={glifo} />;
  if (push.status === 'denied') {
    return (
      <IndexRow
        icon={icono}
        title="Avisos en este dispositivo"
        meta="Bloqueados en este navegador"
        tone="warn"
        onOpen={() => abrir('avisos')}
      />
    );
  }
  return (
    <SwitchRow
      icon={icono}
      title="Avisos en este dispositivo"
      meta={metaDispositivo(push.status, push.error, estado?.dispositivos)}
      checked={push.status === 'subscribed'}
      disabled={push.status === 'loading' || push.status === 'unsupported'}
      onCheckedChange={(checked) => (checked ? push.subscribe() : push.unsubscribe())}
    />
  );
}

function WeeklyReviewRow({ abrir }: { abrir: Abrir }) {
  const { data: ajustes } = useUserSettings();
  return (
    <IndexRow
      icon={<CalendarClock aria-hidden className={glifo} />}
      title="Revisión semanal"
      meta="Se reparte lo vencido"
      value={ajustes ? diaCorto(ajustes.weeklyReviewDay) : <Pendiente className="w-8" />}
      onOpen={() => abrir('revision')}
      onPrefetch={precargar('revision')}
    />
  );
}

function AccountRow({ abrir }: { abrir: Abrir }) {
  const { data: cuenta } = useAccount();
  return (
    <IndexRow
      icon={<UserRound aria-hidden className={glifo} />}
      title={cuenta ? cuenta.name : <Pendiente className="h-4 w-32" />}
      meta={cuenta ? cuenta.email : undefined}
      onOpen={() => abrir('cuenta')}
      onPrefetch={precargar('cuenta')}
    />
  );
}

function ConnectionsRow({ abrir }: { abrir: Abrir }) {
  return (
    <IndexRow
      icon={<Link2 aria-hidden className={glifo} />}
      title="Conexiones"
      meta={useConnectionsMeta()}
      onOpen={() => abrir('conexiones')}
      onPrefetch={precargar('conexiones')}
    />
  );
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
  const limpiarGithub = useRef<() => void>(() => {});
  const alCerrarConexiones = useCallback((limpiar: () => void) => {
    limpiarGithub.current = limpiar;
  }, []);
  const cerrar = (open: boolean) => {
    if (open) return;
    if (hoja === 'conexiones') limpiarGithub.current();
    setHoja(null);
  };

  return (
    <div data-slot="settings-index" className="max-w-[40rem] space-y-8 pb-10">
      <Suspense>
        <RegresoDeGithub abrir={setHoja} alCerrar={alCerrarConexiones} />
      </Suspense>

      <SettingsGroup title="Cada día">
        <ThemeRow />
        <EnergyLimitRow />
        <EnergyProfileRow abrir={setHoja} />
        <RemindersRow abrir={setHoja} />
        <DeviceNotificationsRow abrir={setHoja} />
        <WeeklyReviewRow abrir={setHoja} />
      </SettingsGroup>

      <SettingsGroup title="Cuenta">
        <AccountRow abrir={setHoja} />
        <TimezoneRow />
        <ConnectionsRow abrir={setHoja} />
        <IndexRow
          icon={<Bot aria-hidden className={glifo} />}
          title="Agentes"
          meta="Claude, ChatGPT y Codex de OpenAI"
          onOpen={() => setHoja('agentes')}
          onPrefetch={precargar('agentes')}
        />
      </SettingsGroup>

      <SettingsGroup title="Una vez">
        <IndexRow
          className="max-md:hidden"
          icon={<Keyboard aria-hidden className={glifo} />}
          title="Atajos de teclado"
          meta="Para moverte sin soltar el teclado"
          onOpen={() => setHoja('atajos')}
          onPrefetch={precargar('atajos')}
        />
        <IndexRow
          icon={<NotebookPen aria-hidden className={glifo} />}
          title="Diario de sesiones"
          meta="Resúmenes de tu laptop"
          onOpen={() => setHoja('diario')}
          onPrefetch={precargar('diario')}
        />
        <IndexRow
          icon={<Archive aria-hidden className={glifo} />}
          title="Datos y exportación"
          meta="Un ZIP con todo, para llevártelo"
          onOpen={() => setHoja('datos')}
          onPrefetch={precargar('datos')}
        />
        <IndexRow
          icon={<Trash2 aria-hidden className={glifo} />}
          title="Papelera"
          meta="Lo borrado, hasta que lo restaures"
          onOpen={() => setHoja('papelera')}
          onPrefetch={precargar('papelera')}
        />
        <DangerZoneSection />
      </SettingsGroup>

      <SettingsSheet
        open={hoja === 'energia'}
        onOpenChange={cerrar}
        title="Perfil de energía"
        description={`Una tarea pesa según su energía: ${PESO_ENERGIA}. Si un día pasas el límite diario, Hoy te lo dice; nada se bloquea.`}
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
        open={hoja === 'avisos'}
        onOpenChange={cerrar}
        title="Avisos bloqueados"
        description="Este navegador tiene bloqueados los avisos de esta página, y sólo tú puedes devolverle el permiso."
      >
        <AvisosBloqueadosBody />
      </SettingsSheet>
      <SettingsSheet
        open={hoja === 'revision'}
        onOpenChange={cerrar}
        title="Revisión semanal"
        description="El día en que se ofrece repartir lo vencido entre la semana, con la energía de cada día a la vista. Sólo cambia cuándo trabajas cada tarea, nunca su fecha límite."
      >
        <WeeklyReviewDaySection onChosen={() => setHoja(null)} />
      </SettingsSheet>
      <SettingsSheet
        open={hoja === 'cuenta'}
        onOpenChange={cerrar}
        title="Cuenta"
        description="Perfil: tu nombre y tus correos. Seguridad: la contraseña y las sesiones abiertas."
        wide
      >
        <AccountSection />
      </SettingsSheet>
      <SettingsSheet open={hoja === 'conexiones'} onOpenChange={cerrar} title="Conexiones" description={CONEXIONES_DESCRIPCION}>
        <ConnectionsSection />
      </SettingsSheet>
      <SettingsSheet open={hoja === 'agentes'} onOpenChange={cerrar} title="Agentes" description={AGENTES_DESCRIPCION}>
        <AgentsSection />
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
 * renglón), así que el paso del esqueleto a la pantalla no mueve nada. La
 * fila del límite lleva su texto de verdad, que no espera a nadie: su meta
 * puede ocupar dos renglones y el esqueleto los ocupa igual.
 */
export function SettingsIndexSkeleton() {
  const fila = (key: string, opts: { alta?: boolean; soloEscritorio?: boolean; limite?: boolean } = {}) => (
    <div
      key={key}
      data-slot="settings-skeleton-row"
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
        ) : opts.limite ? (
          <>
            <span className="block text-base leading-6 font-semibold text-foreground">Límite diario</span>
            <span className="block text-sm leading-5 text-pretty text-muted-foreground">{META_LIMITE}</span>
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
      {/* La fila del límite reserva el ancho del stepper (2.85rem, la cifra y 2.85rem). */}
      {opts.limite ? (
        <span className="block pl-2.5">
          <Pendiente className="h-[2.85rem] w-[8.4rem] rounded-full" />
        </span>
      ) : (
        <span />
      )}
    </div>
  );
  const grupo = (titulo: string, filas: React.ReactNode[]) => (
    <section key={titulo}>
      <h2 className={TITULO_GRUPO}>{titulo}</h2>
      <div>{filas}</div>
    </section>
  );
  return (
    <div aria-hidden data-slot="settings-index-skeleton" className="max-w-[40rem] space-y-8 pb-10">
      {grupo('Cada día', [
        fila('tema', { alta: true }),
        fila('limite', { limite: true }),
        ...['perfil', 'recordatorios', 'avisos', 'revision'].map((k) => fila(k)),
      ])}
      {grupo('Cuenta', ['cuenta', 'zona', 'conexiones', 'agentes'].map((k) => fila(k)))}
      {grupo('Una vez', [
        fila('atajos', { soloEscritorio: true }),
        ...['diario', 'datos', 'papelera', 'borrar'].map((k) => fila(k)),
      ])}
    </div>
  );
}
