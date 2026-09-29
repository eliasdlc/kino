import type { Priority } from '../../src/shared/lib/effective-priority';

// Las cifras del calendario de avisos, solas. Viven aparte de
// `recordatorios.ts` para que Ajustes pueda contar lo que promete cada
// intensidad con los mismos números sin llevarse al navegador los helpers de
// zona horaria que el cálculo necesita.

export type Intensidad = 'aggressive' | 'medium' | 'low';
export type IntensidadTarea = Intensidad | 'off';

/**
 * Las horas antes del límite en que suena cada intensidad. `0` es la hora
 * misma. Agresivos: seis horas antes y después cada dos, más la última hora.
 */
export const HORAS_ANTES: Record<Intensidad, readonly number[]> = {
  aggressive: [6, 4, 2, 1, 0],
  medium: [6, 2, 0],
  low: [2, 0],
};

/**
 * Cada cuánto insiste una tarea vencida. `null` es no insistir por su cuenta:
 * la vencida sigue saliendo cada mañana en el resumen, sin tope.
 */
export const VENCIDA_CADA_H: Record<Intensidad, number | null> = {
  aggressive: 3,
  medium: 8,
  low: null,
};

/**
 * Cuántos días antes empieza a salir una tarea en el resumen de la mañana,
 * según lo que se eligió de prioridad. Una alta aparece a tres días, a dos y a
 * uno; una crítica, desde la semana antes.
 */
export const DIAS_EN_RESUMEN: Record<Priority, number> = { critical: 7, high: 3, medium: 2, low: 1 };
