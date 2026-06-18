import { parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import type { WeeklyTrend } from '@/features/energy/energy.service';

interface Props {
  trends: WeeklyTrend;
}

// Inicial del día en español por getDay() (0=domingo). X = miércoles, para no
// repetir "M" con martes.
const WEEKDAY_LETTERS = ['D', 'L', 'M', 'X', 'J', 'V', 'S'] as const;

// Construye un mapa date→valor para acceso rápido
function toMap<T extends { date: string }>(rows: T[]): Map<string, T> {
  return new Map(rows.map((r) => [r.date, r]));
}

// Genera las últimas 7 fechas en formato YYYY-MM-DD (hoy es la última)
function lastSevenDates(): string[] {
  const dates: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

export function WeeklyTrendsCard({ trends }: Props) {
  const dates = lastSevenDates();
  const snapshotMap = toMap(trends.snapshots);
  const checkinMap = toMap(trends.checkins);

  const days = dates.map((date) => ({
    date,
    label: WEEKDAY_LETTERS[parseISO(date).getDay()],
    snapshot: snapshotMap.get(date) ?? null,
    checkin: checkinMap.get(date) ?? null,
  }));

  const hasAnyData = days.some((d) => d.snapshot !== null || d.checkin !== null);

  if (!hasAnyData) {
    return (
      <p className="px-4 py-3 text-xs text-muted-foreground">Sin datos aún.</p>
    );
  }

  return (
    <div className="px-4 py-3 space-y-4">
      {/* Barras de completado */}
      <div className="space-y-4">
        <p className="text-xs text-muted-foreground">Tasa de completado</p>
        <div className="flex items-end gap-1 h-10">
          {days.map(({ date, label, snapshot }) => {
            const rate = snapshot?.completionRate ?? null;
            const height = rate !== null ? Math.max(6, Math.round(rate * 100)) : 0;
            return (
              <div key={date} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex items-end" style={{ height: '32px' }}>
                  <div
                    className={cn(
                      'w-full rounded-sm',
                      rate !== null ? 'bg-emerald-500/70' : 'bg-muted/30',
                    )}
                    style={{ height: `${height}%` }}
                    title={rate !== null ? `${Math.round(rate * 100)}%` : 'Sin datos'}
                  />
                </div>
                <span className="text-[9px] text-muted-foreground/60 font-medium">{label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Puntos de nivel de energía */}
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">Nivel de energía registrado</p>
        <div className="flex items-center gap-1 h-10">
          {days.map(({ date, checkin }) => {
            const level = checkin?.currentLevel ?? null;
            const filled = level !== null;
            const dotColor = filled
              ? level >= 70
                ? 'bg-amber-400'
                : level >= 40
                  ? 'bg-amber-300/70'
                  : 'bg-red-400/70'
              : 'bg-muted/30';
            return (
              <div key={date} className="flex-1 flex items-center justify-center h-full">
                <div
                  className={cn('w-2.5 h-2.5 rounded-full', dotColor)}
                  title={filled ? `${level}/100` : 'Sin check-in'}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
