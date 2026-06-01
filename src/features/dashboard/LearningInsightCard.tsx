import { Brain } from 'lucide-react';
import type { Chronotype } from '@/features/energy/energy.utils';

interface LearningInsightCardProps {
  learnedCurve: number[] | null;
  learningAlpha: number;
  chronotype: Chronotype | null;
}

function findPeakRange(curve: number[]): { start: number; end: number } {
  let bestScore = -1;
  let peakStart = 9;

  for (let h = 0; h < 23; h++) {
    const score = (curve[h] ?? 0) + (curve[h + 1] ?? 0);
    if (score > bestScore) {
      bestScore = score;
      peakStart = h;
    }
  }

  return { start: peakStart, end: peakStart + 2 };
}

export function LearningInsightCard({
  learnedCurve,
  learningAlpha,
  chronotype,
}: LearningInsightCardProps) {
  if (!learnedCurve || learnedCurve.length !== 24) return null;

  const { start, end } = findPeakRange(learnedCurve);
  const personalizationPct = Math.round(learningAlpha * 100);

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="px-5 py-4 border-b flex items-center gap-2">
        <Brain className="w-4 h-4 text-muted-foreground" />
        <p className="font-semibold text-sm">Kino te conoce</p>
      </div>

      <div className="px-5 py-4 space-y-3">
        <p className="text-sm">
          Rindes mejor entre{' '}
          <span className="font-semibold text-amber-500 dark:text-amber-400">
            {start}h y {end}h
          </span>
          {chronotype && (
            <span className="text-muted-foreground"> · cronotipo {chronotype}</span>
          )}
        </p>

        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Personalización</span>
            <span>{personalizationPct}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-amber-400 transition-all duration-500"
              style={{ width: `${personalizationPct}%` }}
            />
          </div>
          <p className="text-[10px] text-muted-foreground/60">
            Basado en tus hábitos reales de trabajo
          </p>
        </div>
      </div>
    </div>
  );
}
