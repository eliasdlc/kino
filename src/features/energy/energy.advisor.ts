/**
 * Los patrones que el advisor sabe leer.
 *
 * Faltan dos, y las dos ausencias son decisiones:
 *
 *  * `underuse` se borró el 8 de septiembre (D-22). Su señal, "poca actividad",
 *    ya la dice el estado de regreso después de una ausencia (`convex/today.ts`)
 *    con sus tres cifras, viviendo bajo el plan y sin gastar la apertura del
 *    día. Y apuntaba a una ausencia, no a una fila. No vuelve.
 *  * `overload` dejó de ser un patrón del advisor: el día que no cabe lo dice
 *    `energy.overBudgetExit` con la cifra del presupuesto real, no con una
 *    heurística sobre la instantánea de ayer.
 */
export type PatternId = 'abandonment' | 'disorganization';

export interface SnapshotLike {
  tasksCreated: number;
  tasksCompleted: number;
  tasksOverdue: number;
  criticalCount: number;
  activeCount: number;
  completionRate: number;
}

export interface AdvisorPattern {
  id: PatternId;
  label: string;
  message: string;
  severity: number;    // 1–3
  urgency: number;     // 1–3
  actionability: number; // 1–3
  score: number;       // severity × urgency × actionability
}

function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function makePattern(
  id: PatternId,
  label: string,
  message: string,
  severity: number,
  urgency: number,
  actionability: number,
): AdvisorPattern {
  return { id, label, message, severity, urgency, actionability, score: severity * urgency * actionability };
}

function detectAbandonment(
  today: SnapshotLike,
  recent: SnapshotLike[],
): AdvisorPattern | null {
  const recentRates = recent.slice(0, 3).map((s) => s.completionRate);
  const avgRate = avg(recentRates);
  if (today.tasksOverdue > 10 || (recentRates.length >= 2 && avgRate < 0.25)) {
    return makePattern(
      'abandonment',
      'Tareas sin atender',
      `Tienes ${today.tasksOverdue} tarea${today.tasksOverdue !== 1 ? 's' : ''} vencida${today.tasksOverdue !== 1 ? 's' : ''}. ¿Empezamos con la más pequeña para destrabar?`,
      2, 3, 3,
    );
  }
  return null;
}

function detectDisorganization(
  today: SnapshotLike,
): AdvisorPattern | null {
  const criticalRatio = today.activeCount > 0
    ? today.criticalCount / today.activeCount
    : 0;
  if (today.activeCount > 3 && criticalRatio > 0.7) {
    return makePattern(
      'disorganization',
      'Prioridades planas',
      'Casi todo está marcado como crítico: no todo puede serlo. ¿Elegimos las 2 reales?',
      2, 2, 3,
    );
  }
  return null;
}

/**
 * Detecta los patrones activos y devuelve el de mayor score.
 * Retorna null si ningún patrón aplica.
 */
export function detectTopPattern(
  today: SnapshotLike,
  recent: SnapshotLike[],
): AdvisorPattern | null {
  const candidates: AdvisorPattern[] = [
    detectAbandonment(today, recent),
    detectDisorganization(today),
  ].filter((p): p is AdvisorPattern => p !== null);

  if (candidates.length === 0) return null;
  return candidates.reduce((best, p) => (p.score > best.score ? p : best));
}
