import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatHourRange, CHRONOTYPE_LABELS } from '@/features/energy/energy.utils';
import type { PredictionVerdict, VerificationLoop } from '@/features/energy/energy.prediction';
import type { LearningInsight } from '@/features/energy/energy.types';
import { SLOT_LABELS } from './energyDisplay';

interface LearningInsightCardProps {
  insight: LearningInsight;
}

/**
 * El veredicto como palabra de estado. Va en peso y en tinta; sólo el fallo
 * lleva coral, y lo lleva junto a su palabra.
 */
const VERDICT_WORD: Record<PredictionVerdict, string> = {
  hit: 'Acertada',
  close: 'Cerca',
  miss: 'Fallida',
};

/**
 * El ciclo del día en una línea bajo hairline: lo previsto, lo que
 * registraste y cuánto aprendió la previsión con ese dato. Sin caja: es un
 * renglón más de la sección.
 *
 * Todo sale de datos guardados (la predicción se escribió antes del check-in y el
 * alpha se guardó antes y después de recalibrar) así que ninguna de las tres
 * cifras se reconstruye a posteriori. El sujeto es la previsión, nunca Kino.
 */
function VerificationLoopLine({ loop }: { loop: VerificationLoop }) {
  return (
    <div data-slot="verification-loop" className="space-y-1 border-t border-border pt-2.5">
      <p className="text-sm text-body tabular-nums">
        <b className={cn('font-semibold', loop.verdict === 'miss' ? 'text-task-overdue' : 'text-foreground')}>
          {VERDICT_WORD[loop.verdict]}
        </b>
        {` en la ${SLOT_LABELS[loop.slot].toLowerCase()}: previsto ${loop.predictedLevel}, registraste ${loop.reportedLevel} (${loop.delta > 0 ? '+' : ''}${loop.delta}).`}
      </p>
      <p className="text-[0.82rem] text-muted-foreground">
        {loop.improvementPct !== null
          ? `Con ese dato la previsión mejoró ${loop.improvementPct}\u00a0%, personalización ${loop.alphaAfterPct}\u00a0%.`
          : loop.alphaAfterPct !== null
            ? `La previsión ya lo esperaba y no se movió, personalización ${loop.alphaAfterPct}\u00a0%.`
            : 'Ese check-in es anterior a la medición de cuánto mejora la previsión con cada dato.'}
        {!loop.fromLearnedCurve && ' Salió de tu cronotipo: todavía sin curva aprendida tuya.'}
      </p>
    </div>
  );
}

/**
 * El consejo es prosa, no un estado cerrado: el del pico va en tinta y peso,
 * nunca en el verde de lo hecho.
 */
const TONE_TEXT: Record<string, string> = {
  peak: 'font-semibold text-foreground',
  before: 'text-body',
  after: 'text-muted-foreground',
  rest: 'text-muted-foreground',
};

/**
 * Las últimas semanas de personalización en barras de una rejilla, escaladas
 * con `scaleY` desde abajo (nunca con `height`) y sin animación.
 */
function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  return (
    <span className="flex h-5 items-end gap-0.5" aria-hidden>
      {values.map((v, i) => (
        <span
          key={i}
          className="block h-full w-1 origin-bottom rounded-[1px] bg-input"
          style={{ transform: `scaleY(${(Math.max(8, Math.min(100, v)) / 100).toFixed(2)})` }}
        />
      ))}
    </span>
  );
}

/**
 * Tu patrón: el pico en tinta y en peso, el consejo de ahora, el ciclo de la
 * última predicción y la personalización. Todo en renglones de la columna de
 * texto, sin caja ni pastillas teñidas: el acento queda para lo activo.
 */
export function LearningInsightCard({ insight }: LearningInsightCardProps) {
  const { peak, advice, personalizationPct, trend, trendDelta, sparkline, correlationFactor, accuracy, chronotype, loop } =
    insight;

  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const trendColor =
    trend === 'up' ? 'text-task-done' : trend === 'down' ? 'text-task-overdue' : 'text-muted-foreground';
  const pct = Math.max(0, Math.min(100, personalizationPct));

  return (
    <div className="space-y-2.5 py-2.5">
      {/* Pico + consejo contextual */}
      <div className="space-y-0.5">
        {/* Sin pico, el consejo ya dice que el ritmo se está aprendiendo: un
            renglón propio que lo repitiera sería la misma frase dos veces. */}
        {peak && (
          <p className="text-sm text-body">
            Rindes mejor de{' '}
            <b className="font-semibold text-foreground">{formatHourRange(peak.start, peak.end)}</b>
            {chronotype && <span className="text-muted-foreground">, cronotipo {CHRONOTYPE_LABELS[chronotype]}</span>}.
          </p>
        )}
        <p data-slot="peak-advice" className={cn('text-[0.82rem] font-medium', TONE_TEXT[advice.tone])}>
          {advice.text}
        </p>
      </div>

      {/* El ciclo del día: predicción guardada vs. lo que confirmaste (4.2) */}
      {loop && <VerificationLoopLine loop={loop} />}

      {/* Insights: correlación + precisión, como renglones y no como pastillas */}
      {(correlationFactor !== null || accuracy !== null) && (
        <div className="space-y-0.5 border-t border-border pt-2.5 text-[0.82rem] text-body tabular-nums">
          {correlationFactor !== null && (
            <p>
              <b className="font-semibold text-foreground">{correlationFactor}×</b> más tareas los días que registras.
            </p>
          )}
          {accuracy !== null && (
            <p>
              Según tu feedback, acertada el <b className="font-semibold text-foreground">{accuracy.rate}{'\u00a0'}%</b> de las veces.
            </p>
          )}
        </div>
      )}

      {/* Personalización + tendencia + sparkline */}
      <div className="space-y-1.5 border-t border-border pt-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[0.82rem] text-muted-foreground">Personalización</span>
          <span className="flex items-center gap-2">
            <Sparkline values={sparkline} />
            <span className="text-[0.84rem] font-semibold tabular-nums">{personalizationPct}{'\u00a0'}%</span>
            <span className={cn('inline-flex items-center gap-0.5 text-xs tabular-nums', trendColor)}>
              <TrendIcon className="size-3" aria-hidden />
              {trend !== 'flat' && `${trendDelta > 0 ? '+' : ''}${trendDelta}`}
            </span>
          </span>
        </div>
        {/* Una medida, no una acción: el relleno va en tinta sobre el renglón
            de --input, y el ámbar queda para lo primario y lo activo. */}
        <div data-slot="personalization-bar" className="h-1.5 overflow-hidden rounded-full bg-input">
          <div
            className="h-full w-full origin-left rounded-full bg-foreground transition-transform duration-(--dur-tachar) ease-(--ease-pluma)"
            style={{ transform: `scaleX(${(pct / 100).toFixed(3)})` }}
          />
        </div>
        <p className="text-[0.78rem] text-muted-foreground">Basado en tus hábitos reales de trabajo.</p>
      </div>
    </div>
  );
}
