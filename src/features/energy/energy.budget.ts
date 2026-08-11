/**
 * Presupuesto de energía del día (Fase 4.1 · D2).
 *
 * El día tiene un presupuesto y comprometer tareas lo llena. Pasarse **avisa,
 * jamás bloquea**: el presupuesto es una herramienta de conciencia, no un
 * portero. Un límite que rechaza movimientos enseña a esquivarlo.
 *
 * Módulo puro: lo usan la barra en el cliente (derivada del cache del plan de
 * hoy, sin red extra) y el server cuando necesite el mismo número.
 */

export type EnergyLevel = 'high' | 'medium' | 'low';

/**
 * Peso de cada nivel de energía. Fuente única en TypeScript.
 * `insights.queries.ts` replica estos pesos como CASE SQL para agregar en la
 * base — si cambian aquí, hay que cambiarlos allá.
 */
export const ENERGY_POINTS: Record<EnergyLevel, number> = {
  high: 5,
  medium: 3,
  low: 1,
};

const DEFAULT_ENERGY_POINTS = ENERGY_POINTS.medium;

export function energyPointsFor(level: string | null | undefined): number {
  if (!level) return DEFAULT_ENERGY_POINTS;
  return ENERGY_POINTS[level as EnergyLevel] ?? DEFAULT_ENERGY_POINTS;
}

/** Umbral de "ajustado": avisa antes de romper el presupuesto, no después. */
export const TIGHT_THRESHOLD_PCT = 85;

export type EnergyBudgetState = 'ok' | 'tight' | 'over';

export interface EnergyBudget {
  /** Puntos de todas las tareas del plan de hoy (pendientes + hechas). */
  committed: number;
  /** Puntos de las tareas del plan ya completadas. */
  spent: number;
  /** Puntos comprometidos que aún no se han cumplido. */
  pending: number;
  /** Lo que queda del presupuesto; 0 si hay sobregiro. */
  remaining: number;
  limit: number;
  /** Comprometido sobre el límite, en % (puede pasar de 100). */
  pct: number;
  /** Gastado sobre el límite, en % (acotado a 100 para dibujar). */
  spentPct: number;
  state: EnergyBudgetState;
  /** Cuánto se pasa del límite; 0 si no hay sobregiro. */
  overBy: number;
}

/** Lo mínimo que el presupuesto necesita saber de una tarea. */
export interface BudgetTask {
  energyLevel?: string | null;
  status?: string | null;
}

/**
 * Presupuesto del día a partir de las tareas comprometidas.
 *
 * `tasks` son las del plan de hoy (`inTodayPlan`), incluidas las completadas:
 * el presupuesto mide **lo que prometiste**, y por dentro muestra cuánto ya
 * cumpliste. Medir solo lo hecho —como hacía el límite duro anterior— castiga
 * producir en vez de avisar de sobre-prometer.
 */
export function computeEnergyBudget(tasks: BudgetTask[], limit: number): EnergyBudget {
  let committed = 0;
  let spent = 0;

  for (const task of tasks) {
    const points = energyPointsFor(task.energyLevel);
    committed += points;
    if (task.status === 'done') spent += points;
  }

  // Un límite inválido (0 o negativo por datos corruptos) no debe dividir por
  // cero ni reportar sobregiro infinito: se trata como "sin presupuesto útil".
  const safeLimit = limit > 0 ? limit : 0;
  const pct = safeLimit > 0 ? Math.round((committed / safeLimit) * 100) : 0;
  const spentPct = safeLimit > 0 ? Math.min(100, Math.round((spent / safeLimit) * 100)) : 0;
  const overBy = safeLimit > 0 ? Math.max(0, committed - safeLimit) : 0;

  const state: EnergyBudgetState =
    overBy > 0 ? 'over' : pct >= TIGHT_THRESHOLD_PCT ? 'tight' : 'ok';

  return {
    committed,
    spent,
    pending: committed - spent,
    remaining: Math.max(0, safeLimit - committed),
    limit: safeLimit,
    pct,
    spentPct,
    state,
    overBy,
  };
}

/**
 * Une el plan de hoy con tareas que se están comprometiendo ahora, sin contar dos
 * veces las que ya estaban dentro. Sin esto, re-mover a «Hoy» algo ya comprometido
 * infla el presupuesto y produce un sobregiro que no existe.
 */
export function mergeCommitted<T extends { id: string }>(planTasks: T[], candidates: T[]): T[] {
  const alreadyInPlan = new Set(planTasks.map((t) => t.id));
  return [...planTasks, ...candidates.filter((t) => !alreadyInPlan.has(t.id))];
}

/**
 * Si comprometer `task` cruzaría el límite estando dentro. Sirve para avisar en
 * el momento exacto del cruce sin repetir el aviso en cada tarea posterior.
 */
export function crossesLimitWith(
  current: EnergyBudget,
  task: BudgetTask,
): { crosses: boolean; overBy: number; next: number } {
  const next = current.committed + energyPointsFor(task.energyLevel);
  if (current.limit <= 0) return { crosses: false, overBy: 0, next };
  const overBy = next - current.limit;
  return {
    crosses: current.committed <= current.limit && overBy > 0,
    overBy: Math.max(0, overBy),
    next,
  };
}
