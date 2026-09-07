export type PatternId = 'overload' | 'abandonment' | 'disorganization' | 'underuse';

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

function detectOverload(
  today: SnapshotLike,
  availableHoursPerDay: number,
): AdvisorPattern | null {
  const capacityThreshold = availableHoursPerDay * 2;
  if (today.criticalCount > 5 || today.activeCount > capacityThreshold) {
    return makePattern(
      'overload',
      'Sobrecarga detectada',
      'Hoy hay más de lo que tu energía puede sostener. ¿Muevo las 3 menos urgentes a mañana?',
      3, 3, 3,
    );
  }
  return null;
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

function detectUnderuse(
  recent: SnapshotLike[],
): AdvisorPattern | null {
  const window = recent.slice(0, 5);
  if (window.length < 3) return null; // sin historial suficiente
  const avgCreated = avg(window.map((s) => s.tasksCreated));
  const avgCompleted = avg(window.map((s) => s.tasksCompleted));
  if (avgCreated < 2 && avgCompleted < 1) {
    return makePattern(
      'underuse',
      'Poco movimiento',
      'Esta semana hay poca actividad. ¿Quieres revisar tu sistema más activo?',
      1, 1, 2,
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
  availableHoursPerDay: number,
): AdvisorPattern | null {
  const candidates: AdvisorPattern[] = [
    detectOverload(today, availableHoursPerDay),
    detectAbandonment(today, recent),
    detectDisorganization(today),
    detectUnderuse(recent),
  ].filter((p): p is AdvisorPattern => p !== null);

  if (candidates.length === 0) return null;
  return candidates.reduce((best, p) => (p.score > best.score ? p : best));
}
