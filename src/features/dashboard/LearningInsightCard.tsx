import { TrendingUp, TrendingDown, Minus, Sparkles, Target, Gauge, Crosshair, CircleSlash } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatHourRange, CHRONOTYPE_LABELS } from '@/features/energy/energy.utils';
import { VERDICT_LABELS, type PredictionVerdict, type VerificationLoop } from '@/features/energy/energy.prediction';
import type { LearningInsight } from '@/features/energy/energy.types';
import { SLOT_LABELS } from './energyDisplay';

interface LearningInsightCardProps {
  insight: LearningInsight;
}

const VERDICT_ICON: Record<PredictionVerdict, typeof Target> = {
  hit: Target,
  close: Crosshair,
  miss: CircleSlash,
};

const VERDICT_TONE: Record<PredictionVerdict, string> = {
  hit: 'text-task-done',
  close: 'text-primary',
  miss: 'text-task-overdue',
};

/**
 * El ciclo del día: predije X, confirmaste Y, mi modelo mejoró Z.
 *
 * Todo sale de datos guardados (la predicción se escribió antes del check-in y el
 * alpha se guardó antes y después de recalibrar) así que ninguna de las tres
 * cifras se reconstruye a posteriori.
 */
function VerificationLoopBlock({ loop }: { loop: VerificationLoop }) {
  const Icon = VERDICT_ICON[loop.verdict];
  const tone = VERDICT_TONE[loop.verdict];

  return (
    <div className="rounded-lg border bg-muted/30 px-3 py-2 space-y-1">
      <div className="flex items-center gap-1.5">
        <Icon className={cn('w-3.5 h-3.5 shrink-0', tone)} />
        <span className={cn('text-xs font-semibold', tone)}>{VERDICT_LABELS[loop.verdict]}</span>
        <span className="text-xs text-muted-foreground">· {SLOT_LABELS[loop.slot].toLowerCase()}</span>
      </div>

      <p className="text-xs">
        Predije <span className="font-semibold tabular-nums">{loop.predictedLevel}</span>
        {' · reportaste '}
        <span className="font-semibold tabular-nums">{loop.reportedLevel}</span>
        <span className={cn('ml-1 tabular-nums', tone)}>
          ({loop.delta > 0 ? '+' : ''}{loop.delta})
        </span>
      </p>

      <p className="text-xs text-muted-foreground">
        {loop.improvementPct !== null
          ? `Con ese dato mi modelo de ti mejoró ${loop.improvementPct} %: personalización ${loop.alphaAfterPct} %.`
          : loop.alphaAfterPct !== null
            ? `Mi modelo no se movió con ese dato, ya te esperaba así: personalización ${loop.alphaAfterPct} %.`
            : 'Ese check-in es anterior a que empezara a medir cuánto mejoro con cada dato.'}
      </p>

      {!loop.fromLearnedCurve && (
        <p className="text-[0.65rem] text-muted-foreground/70">
          Esa predicción salió de tu cronotipo: todavía no tenía curva aprendida tuya.
        </p>
      )}
    </div>
  );
}

const TONE_TEXT: Record<string, string> = {
  peak: 'text-task-done',
  before: 'text-primary',
  after: 'text-muted-foreground',
  rest: 'text-muted-foreground',
};

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  return (
    <div className="flex items-end gap-0.5 h-5" aria-hidden>
      {values.map((v, i) => (
        <div
          key={i}
          className="w-1 rounded-sm bg-primary/70 transition-[height] duration-500"
          style={{ height: `${Math.max(8, v)}%` }}
        />
      ))}
    </div>
  );
}

export function LearningInsightCard({ insight }: LearningInsightCardProps) {
  const { peak, advice, personalizationPct, trend, trendDelta, sparkline, correlationFactor, accuracy, chronotype, loop } =
    insight;

  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const trendColor =
    trend === 'up' ? 'text-task-done' : trend === 'down' ? 'text-task-overdue' : 'text-muted-foreground';

  return (
    <div className="px-4 py-2.5 space-y-2">
      {/* Pico + consejo contextual */}
      <div className="space-y-0.5">
        {peak ? (
          <p className="text-sm">
            Rindes mejor entre{' '}
            <span className="font-semibold text-primary">
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

      {/* El ciclo del día: predicción guardada vs. lo que confirmaste (4.2) */}
      {loop && <VerificationLoopBlock loop={loop} />}

      {/* Insights: correlación + precisión */}
      {(correlationFactor !== null || accuracy !== null) && (
        <div className="flex flex-wrap gap-1.5">
          {correlationFactor !== null && (
            <span className="inline-flex items-center gap-1 text-xs rounded-md bg-task-done/15 text-task-done px-2 py-1">
              <Target className="w-3 h-3 shrink-0" />
              {correlationFactor}× más tareas los días que registras
            </span>
          )}
          {accuracy !== null && (
            <span className="inline-flex items-center gap-1 text-xs rounded-md bg-muted px-2 py-1 text-muted-foreground">
              <Gauge className="w-3 h-3 shrink-0" />
              Según tu feedback: acertada {accuracy.rate}%
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
            <span className={cn('inline-flex items-center gap-0.5 text-xs tabular-nums', trendColor)}>
              <TrendIcon className="w-3 h-3" />
              {trend !== 'flat' && `${trendDelta > 0 ? '+' : ''}${trendDelta}`}
            </span>
          </div>
        </div>
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all duration-700 ease-out"
            style={{ width: `${personalizationPct}%` }}
          />
        </div>
        <p className="text-[0.65rem] text-muted-foreground/60">Basado en tus hábitos reales de trabajo</p>
      </div>
    </div>
  );
}
