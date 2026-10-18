import { cn } from '@/lib/utils';
import { formatHour } from '@/features/energy/energy.utils';

export interface ChartEntry {
  hour: number;
  predicted: number | null;
  actual: number | null;
}

interface EnergyChartProps {
  data: ChartEntry[];
  peak: { start: number; end: number } | null;
  currentHour: number;
  className?: string;
}

/**
 * La curva contada en una frase, para quien no la ve: el pico previsto, lo
 * previsto a esta hora y cada registro con su hora.
 */
export function curveSummary(data: ChartEntry[], peak: { start: number; end: number } | null, currentHour: number): string {
  const ahora = data.find((d) => d.hour === currentHour)?.predicted;
  const registros = data.filter((d) => d.actual != null);
  const partes = [
    'Curva de energía del día.',
    peak ? `Pico previsto de ${formatHour(peak.start)} a ${formatHour(peak.end)}.` : null,
    ahora != null ? `A las ${formatHour(currentHour)} se prevén ${ahora}.` : null,
    registros.length > 0
      ? `${registros.length} registro${registros.length === 1 ? '' : 's'}: ${registros
          .map((d) => `${d.actual} a las ${formatHour(d.hour)}`)
          .join(', ')}.`
      : 'Sin registros hoy.',
  ];
  return partes.filter(Boolean).join(' ');
}

/** Las 24 columnas de la curva, compartidas por las barras y las horas. */
const COLUMNS = 'grid grid-cols-[repeat(24,minmax(0,1fr))] gap-[0.14rem]';

/** Las horas que se rotulan bajo la curva. */
export const HOUR_TICKS = [6, 12, 18] as const;

/**
 * La curva del día en CSS: 24 barras de una rejilla, cada una escalada con
 * `scaleY` desde abajo (nunca con `height`), las del pico en el acento y la
 * de ahora en tinta. Un registro es un punto en su columna, a la altura del
 * valor. No se anima: una curva que crece cada vez que se abre Hoy es un
 * bucle disfrazado. La figura entera lleva su frase como nombre accesible, y
 * debajo van rotuladas las 6, las 12 y las 18 en mute.
 */
export function EnergyChart({ data, peak, currentHour, className }: EnergyChartProps) {
  const isPeakHour = (hour: number) => (peak ? hour >= peak.start && hour < peak.end : false);

  return (
    <div className={className}>
      <figure
        role="img"
        aria-label={curveSummary(data, peak, currentHour)}
        className={cn(COLUMNS, 'h-12 items-end')}
      >
        {data.map((d) => {
          const peakHour = isPeakHour(d.hour);
          const isNow = d.hour === currentHour;
          const predicted = Math.max(0, Math.min(100, d.predicted ?? 0));
          return (
            <span key={d.hour} className="relative block h-full min-w-0" aria-hidden>
              <span
                data-hour={d.hour}
                data-now={isNow ? '' : undefined}
                data-peak={peakHour ? '' : undefined}
                className={cn(
                  'block h-full w-full origin-bottom rounded-[2px]',
                  peakHour ? 'bg-primary' : isNow ? 'bg-foreground' : 'bg-input',
                )}
                // 4 % como suelo para que una hora a cero siga dibujando el renglón.
                style={{ transform: `scaleY(${Math.max(0.04, predicted / 100).toFixed(2)})` }}
              />
              {d.actual != null && (
                <i
                  data-actual={d.actual}
                  className="absolute left-1/2 size-2 -translate-x-1/2 translate-y-1/2 rounded-full border-[1.5px] border-foreground bg-background"
                  style={{ bottom: `${Math.max(0, Math.min(100, d.actual))}%` }}
                />
              )}
            </span>
          );
        })}
      </figure>
      {/* Las horas bajo las barras, para quien la ve: la frase de arriba ya la
          cuenta entera a un lector de pantalla. */}
      <div data-slot="curve-hours" className={cn(COLUMNS, 'mt-1 text-[0.7rem] leading-none text-muted-foreground tabular-nums')} aria-hidden>
        {HOUR_TICKS.map((hour) => (
          <span key={hour} className="justify-self-center" style={{ gridColumnStart: hour + 1 }}>
            {hour}
          </span>
        ))}
      </div>
    </div>
  );
}
