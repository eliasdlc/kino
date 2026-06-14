// Presets de sesión de enfoque: distinta duración según el tipo de tarea y la
// energía actual. El "hueco" del dashboard ofrece estos sets para arrancar foco.

export type TaskDemand = 'high' | 'medium' | 'low';

export interface FocusSession {
  key: string;
  label: string;
  minutes: number;
}

const DEEP: FocusSession = { key: 'deep', label: 'Profundo', minutes: 50 };
const SPRINT: FocusSession = { key: 'sprint', label: 'Sprint', minutes: 25 };
const SHORT: FocusSession = { key: 'short', label: 'Corto', minutes: 15 };
const MICRO: FocusSession = { key: 'micro', label: 'Micro', minutes: 10 };

/**
 * Recomienda 2 sesiones (primaria + alternativa) según la demanda de la tarea
 * y la energía actual. Con energía baja no empuja un bloque profundo.
 */
export function recommendSessions(demand: TaskDemand, energy: number): FocusSession[] {
  const high = energy >= 70;
  const low = energy < 40;

  if (demand === 'high') {
    if (low) return [SPRINT, SHORT];
    if (high) return [DEEP, SPRINT];
    return [SPRINT, DEEP];
  }
  if (demand === 'medium') {
    return low ? [SHORT, MICRO] : [SPRINT, SHORT];
  }
  return [SHORT, MICRO];
}

const DEMAND_LABEL: Record<TaskDemand, string> = {
  high: 'alta demanda',
  medium: 'demanda media',
  low: 'demanda baja',
};

export function demandLabel(demand: TaskDemand): string {
  return DEMAND_LABEL[demand];
}
