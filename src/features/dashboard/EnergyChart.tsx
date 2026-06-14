'use client';

import {
  ComposedChart,
  Bar,
  Cell,
  Line,
  ReferenceLine,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
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
  animate: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function EnergyTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const predicted = payload.find((p: { dataKey: string }) => p.dataKey === 'predicted')?.value as number | undefined;
  const actual = payload.find((p: { dataKey: string }) => p.dataKey === 'actual')?.value as number | undefined;
  return (
    <div className="rounded-md border bg-popover px-2 py-1 text-xs shadow">
      <p className="text-muted-foreground mb-0.5">{formatHour(label)}</p>
      {predicted != null && <p>Previsto: <span className="font-medium">{predicted}</span></p>}
      {actual != null && <p>Registrado: <span className="font-medium">{actual}</span></p>}
    </div>
  );
}

export function EnergyChart({ data, peak, currentHour, animate }: EnergyChartProps) {
  const isPeakHour = (hour: number) => (peak ? hour >= peak.start && hour < peak.end : false);

  return (
    <ResponsiveContainer width="100%" height={76}>
      <ComposedChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
        <XAxis dataKey="hour" hide />
        <YAxis domain={[0, 100]} hide />
        <Bar
          dataKey="predicted"
          barSize={5}
          radius={[2, 2, 0, 0]}
          isAnimationActive={animate}
          animationDuration={600}
          animationEasing="ease-out"
        >
          {data.map((d) => {
            const peakHour = isPeakHour(d.hour);
            const isNow = d.hour === currentHour;
            return (
              <Cell
                key={d.hour}
                fill={peakHour ? '#fbbf24' : isNow ? '#cbd5e1' : '#94a3b8'}
                fillOpacity={peakHour ? 0.95 : isNow ? 0.6 : 0.3}
              />
            );
          })}
        </Bar>
        <Line
          dataKey="actual"
          stroke="transparent"
          dot={(props) => {
            const { cx, cy, value } = props as { cx: number; cy: number; value: number | null };
            if (value == null) return <g key={`dot-${cx}`} />;
            return (
              <circle
                key={`dot-${cx}`}
                cx={cx}
                cy={cy}
                r={4}
                fill="#fafafa"
                stroke="#1c1917"
                strokeWidth={1.5}
              />
            );
          }}
          isAnimationActive={false}
          connectNulls={false}
        />
        <ReferenceLine
          x={currentHour}
          stroke="rgba(255,255,255,0.5)"
          strokeDasharray="3 3"
          strokeWidth={1.5}
        />
        <Tooltip content={<EnergyTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
