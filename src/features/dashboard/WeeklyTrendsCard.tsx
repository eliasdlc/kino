import { parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { calendarDayInTz } from '@/shared/time';
import type { WeeklyTrend } from '@/features/energy/energy.types';

interface Props {
  trends: WeeklyTrend;
}

// Inicial del día en español por getDay() (0=domingo). X = miércoles, para no
// repetir "M" con martes.
const WEEKDAY_LETTERS = ['D', 'L', 'M', 'X', 'J', 'V', 'S'] as const;
const WEEKDAY_NAMES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'] as const;

// Construye un mapa date→valor para acceso rápido
function toMap<T extends { date: string }>(rows: T[]): Map<string, T> {
  return new Map(rows.map((r) => [r.date, r]));
}

// Genera las últimas 7 fechas en formato YYYY-MM-DD (hoy es la última).
// Día calendario local, no UTC: a las 22:00 en una tz negativa toISOString()
// ya daría "mañana" y desalinearía el eje contra los `date` locales de la DB.
function lastSevenDates(): string[] {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const dates: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86_400_000);
    dates.push(calendarDayInTz(d, tz));
  }
  return dates;
}

interface Day {
  date: string;
  label: string;
  name: string;
  rate: number | null;
  level: number | null;
}

/**
 * Las dos tiras contadas en una frase, para quien no las ve: cada día con su
 * valor, o que no lo tiene. Las alturas y los colores no llegan a un lector de
 * pantalla ni a un dedo (un `title` sólo existe con ratón).
 */
export function completionSummary(days: readonly Day[]): string {
  return `Tasa de completado de los últimos 7 días: ${days
    .map((d) => `${d.name} ${d.rate === null ? 'sin datos' : `${Math.round(d.rate * 100)}\u00a0%`}`)
    .join(', ')}.`;
}

export function energySummary(days: readonly Day[]): string {
  return `Energía registrada en los últimos 7 días: ${days
    .map((d) => `${d.name} ${d.level === null ? 'sin check-in' : `${d.level} de 100`}`)
    .join(', ')}.`;
}

/**
 * Los últimos siete días: la tasa de completado en barras y la energía
 * registrada en puntos, con la inicial del día debajo en mute pleno y a un
 * tamaño que se lee. La energía baja es ámbar tenue y no coral: el coral va
 * sólo junto a una palabra de estado, y aquí no la hay. Cada tira lleva su
 * frase como nombre accesible, igual que la curva de Hoy. Sin datos, una frase en la voz que dice cuándo aparece.
 */
export function WeeklyTrendsCard({ trends }: Props) {
  const dates = lastSevenDates();
  const snapshotMap = toMap(trends.snapshots);
  const checkinMap = toMap(trends.checkins);

  const days: Day[] = dates.map((date) => {
    const weekday = parseISO(date).getDay();
    return {
      date,
      label: WEEKDAY_LETTERS[weekday]!,
      name: WEEKDAY_NAMES[weekday]!,
      rate: snapshotMap.get(date)?.completionRate ?? null,
      level: checkinMap.get(date)?.currentLevel ?? null,
    };
  });

  const hasAnyData = days.some((d) => d.rate !== null || d.level !== null);

  if (!hasAnyData) {
    return (
      <p data-slot="weekly-empty" className="font-voice py-3 text-[0.98rem] leading-snug text-body italic">
        La semana se dibuja aquí cuando registres tu energía o cierres tu primera tarea.
      </p>
    );
  }

  return (
    <div className="space-y-4 py-3">
      {/* Barras de completado */}
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">Tasa de completado</p>
        <div role="img" aria-label={completionSummary(days)} className="flex items-end gap-1">
          {days.map(({ date, label, rate }) => {
            const height = rate !== null ? Math.max(6, Math.round(rate * 100)) : 0;
            return (
              <div key={date} className="flex flex-1 flex-col items-center gap-1" aria-hidden>
                <div className="flex h-8 w-full items-end">
                  <div
                    className={cn('w-full rounded-sm', rate !== null ? 'bg-task-done' : 'bg-muted/30')}
                    style={{ height: `${height}%` }}
                  />
                </div>
                <span data-slot="weekday" className="text-[0.74rem] leading-none font-medium text-muted-foreground">
                  {label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Puntos de nivel de energía */}
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">Nivel de energía registrado</p>
        <div role="img" aria-label={energySummary(days)} className="flex h-10 items-center gap-1">
          {days.map(({ date, level }) => {
            const dotColor =
              level === null
                ? 'bg-muted/30'
                : level >= 70
                  ? 'bg-primary'
                  : level >= 40
                    ? 'bg-primary/70'
                    : 'bg-primary/35';
            return (
              <div key={date} className="flex h-full flex-1 items-center justify-center" aria-hidden>
                <div className={cn('size-2.5 rounded-full', dotColor)} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
