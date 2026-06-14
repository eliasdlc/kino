import { TrendingUp, TrendingDown, Minus, Sparkles, Target, Gauge } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatHourRange, CHRONOTYPE_LABELS } from '@/features/energy/energy.utils';
import type { LearningInsight } from '@/features/energy/energy.service';

interface LearningInsightCardProps {
  insight: LearningInsight;
}

const TONE_TEXT: Record<string, string> = {
  peak: 'text-emerald-500 dark:text-emerald-400',
  before: 'text-amber-500 dark:text-amber-400',
  after: 'text-muted-foreground',
  rest: 'text-indigo-400',
};

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  return (
    <div className="flex items-end gap-[3px] h-5" aria-hidden>
      {values.map((v, i) => (
        <div
          key={i}
          className="w-1 rounded-sm bg-amber-400/70 transition-[height] duration-500"
          style={{ height: `${Math.max(8, v)}%` }}
        />
      ))}
    </div>
  );
}

export function LearningInsightCard({ insight }: LearningInsightCardProps) {
  const { peak, advice, personalizationPct, trend, trendDelta, sparkline, correlationFactor, accuracy, chronotype } =
    insight;

  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const trendColor =
    trend === 'up' ? 'text-emerald-500' : trend === 'down' ? 'text-red-400' : 'text-muted-foreground';

  return (
    <div className="px-4 py-2.5 space-y-2">
      {/* Pico + consejo contextual */}
      <div className="space-y-0.5">
        {peak ? (
          <p className="text-sm">
            Rindes mejor entre{' '}
            <span className="font-semibold text-amber-500 dark:text-amber-400">
              {formatHourRange(peak.start, peak.end)}
            </span>
            {chronotype && (
              <span className="text-muted-foreground"> · cronotipo {CHRONOTYPE_LABELS[chronotype]}</span>
            )}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">Kino está conociendo tu ritmo</p>
        )}
        <p className={cn('text-xs font-medium', TONE_TEXT[advice.tone])}>{advice.text}</p>
      </div>

      {/* Insights: correlación + precisión */}
      {(correlationFactor !== null || accuracy !== null) && (
        <div className="flex flex-wrap gap-1.5">
          {correlationFactor !== null && (
            <span className="inline-flex items-center gap-1 text-[11px] rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-1">
              <Target className="w-3 h-3 shrink-0" />
              {correlationFactor}× más tareas los días que registras
            </span>
          )}
          {accuracy !== null && (
            <span className="inline-flex items-center gap-1 text-[11px] rounded-md bg-muted px-2 py-1 text-muted-foreground">
              <Gauge className="w-3 h-3 shrink-0" />
              Predicción acertada {accuracy.rate}%
            </span>
          )}
        </div>
      )}

      {/* Personalización + tendencia + sparkline */}
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Sparkles className="w-3 h-3" />
            Personalización
          </span>
          <div className="flex items-center gap-2">
            <Sparkline values={sparkline} />
            <span className="text-xs font-semibold tabular-nums">{personalizationPct}%</span>
            <span className={cn('inline-flex items-center gap-0.5 text-[11px] tabular-nums', trendColor)}>
              <TrendIcon className="w-3 h-3" />
              {trend !== 'flat' && `${trendDelta > 0 ? '+' : ''}${trendDelta}`}
            </span>
          </div>
        </div>
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-amber-400 transition-all duration-700 ease-out"
            style={{ width: `${personalizationPct}%` }}
          />
        </div>
        <p className="text-[10px] text-muted-foreground/60">Basado en tus hábitos reales de trabajo</p>
      </div>
    </div>
  );
}
