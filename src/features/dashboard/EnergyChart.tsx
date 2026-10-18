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

/**
 * La curva del día en CSS: 24 barras de una rejilla, cada una escalada con
 * `scaleY` desde abajo (nunca con `height`), las del pico en el acento y la
 * de ahora en tinta. Un registro es un punto en su columna, a la altura del
 * valor. No se anima: una curva que crece cada vez que se abre Hoy es un
 * bucle disfrazado. La figura entera lleva su frase como nombre accesible.
 */
export function EnergyChart({ data, peak, currentHour, className }: EnergyChartProps) {
  const isPeakHour = (hour: number) => (peak ? hour >= peak.start && hour < peak.end : false);

  return (
    <figure
      role="img"
      aria-label={curveSummary(data, peak, currentHour)}
      className={cn('grid h-12 grid-cols-[repeat(24,minmax(0,1fr))] items-end gap-[0.14rem]', className)}
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
  );
}
