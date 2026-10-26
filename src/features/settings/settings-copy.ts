import type { Intensidad } from '@convex/lib/recordatoriosConstantes';
import { WEEKDAY_LABELS, type Weekday } from '@/features/energy/energy.ritual';

/**
 * Lo que el índice de Ajustes necesita saber de cada hoja sin cargar la hoja:
 * los nombres de los valores, las frases de arriba y el alto que reservan.
 *
 * Vive aparte, sin componentes, porque un módulo que el índice importa de
 * forma estática viaja en el chunk de /settings aunque la hoja también se
 * importe con `next/dynamic`: un `import()` no parte lo que ya está dentro.
 * Las hojas importan de aquí; el índice nunca importa una hoja.
 */

export type Chronotype = 'morning' | 'intermediate' | 'evening';

export const CRONOTIPOS: ReadonlyArray<{ value: Chronotype; label: string; desc: string }> = [
  { value: 'morning', label: 'Mañana', desc: 'Rindes mejor antes del mediodía; después de comer la energía baja.' },
  { value: 'intermediate', label: 'Mixto', desc: 'Tu energía es bastante estable a lo largo del día.' },
  { value: 'evening', label: 'Noche', desc: 'Arrancas lento y agarras velocidad en la tarde o la noche.' },
];

export const INTENSIDADES: ReadonlyArray<{ value: Intensidad; label: string }> = [
  { value: 'low', label: 'Bajos' },
  { value: 'medium', label: 'Medios' },
  { value: 'aggressive', label: 'Agresivos' },
];

/** "08:00" a "8:00" y "22:00" a "22": la hora como se dice, para la meta del índice. */
export function horaCorta(hhmm: string, conMinutos = true): string {
  const [h, m] = hhmm.split(':');
  const hora = String(Number(h));
  if (m === '00' && !conMinutos) return hora;
  return `${hora}:${m}`;
}

/** El día en tres letras para el valor del índice: "Dom". */
export function diaCorto(day: Weekday): string {
  return WEEKDAY_LABELS[day].slice(0, 3);
}

/** Cómo se llama cada fuente conectada en pantalla. */
export const NOMBRE_FUENTE: Record<string, string> = { github: 'GitHub' };

/** Lo que la hoja de Conexiones explica arriba. */
export const CONEXIONES_DESCRIPCION =
  'De dónde entra trabajo que no escribiste tú. Lo que traiga una fuente no pisa lo que añadas encima: la energía, la fecha y el plan de hoy siguen siendo tuyos.';

/** Lo que la hoja de Agentes explica arriba. */
export const AGENTES_DESCRIPCION =
  'Conecta Claude, ChatGPT o Codex de OpenAI. Entras con tu cuenta de Kino y lo autorizas; no hay claves que copiar.';

/** Lo que la hoja de Datos explica arriba. */
export const DATOS_DESCRIPCION =
  'Bájate todo lo tuyo: un JSON por tabla para reimportarlo y un Markdown por capítulo para leerlo en cualquier otra herramienta.';

/**
 * Lo que pesa cada tarea según su energía: la unidad del límite diario. Cada
 * peso va unido a su cifra con un espacio duro, para que un renglón estrecho
 * no deje "alta" arriba y su 5 abajo.
 */
export const PESO_ENERGIA = 'alta\u00a05, media\u00a03, baja\u00a01';

/**
 * La meta del límite diario: explica qué es un punto ahí mismo, donde se
 * ajusta. Junto al stepper ocupa dos renglones en el teléfono.
 */
export const META_LIMITE = `Puntos: ${PESO_ENERGIA}`;

/**
 * El alto que reserva la hoja de Cuenta, cargue o no el panel de Clerk: el de
 * la página de Perfil en 393 px con su segmento. Sin él la hoja inferior
 * crecía de golpe cuando llegaba el panel. Lo usan la hoja y su espera.
 */
export const ALTO_CUENTA = 'min-h-[33rem]';
