import { buildSuggestions } from "@/shared/suggestions/engine";
import type { Suggestion, SuggestionRule, SuggestionTarget } from "@/shared/suggestions/types";

/**
 * El mini cerebro de un sistema: un párrafo de estado con su fecha y hasta seis
 * hechos, cada uno con la fila que lo respalda.
 *
 * Las dos reglas que lo definen son negativas, y son justo las que evitan que
 * esto acabe siendo un panel de métricas. **Un hecho sin fila no se pinta**: por
 * eso `target` y `occurredAt` son obligatorios aquí, mientras que en el patrón
 * compartido `target` es opcional. Y **seis es un techo, no un objetivo**: el
 * motor recorta después de ordenar, así que un sistema con dos cosas que decir
 * dice dos en vez de rellenar cuatro huecos con señales débiles.
 *
 * Aquí no hay ninguna cuenta de fechas ni de zonas horarias: las filas llegan
 * con su día ya escrito. "Hoy en la zona del usuario" se calcula en el
 * servidor y este fichero sólo redacta.
 */

export type FactKind =
  | "overdue"
  | "pileup"
  | "stalled"
  | "next-due"
  | "empty-container"
  | "last-move"
  | "last-closed"
  | "observed-time";

/** A dónde lleva un hecho: siempre a la fila que lo respalda. */
export interface FactTarget extends SuggestionTarget {
  kind: "task" | "folder" | "page";
  id: string;
}

export interface SystemFact extends Suggestion<FactKind, FactTarget> {
  /** Obligatorio, al revés que en el patrón compartido: un hecho sin fila no existe. */
  target: FactTarget;
  /** La fecha de esa fila, en ISO. Es la misma que el texto del hecho enseña. */
  occurredAt: string;
}

/**
 * Una fila de la base tal como el mini cerebro la cita: a dónde lleva, cómo se
 * llama, cuándo pasó y cómo se lee esa fecha.
 */
export interface FactRow {
  target: FactTarget;
  title: string;
  /** Instante ISO de la fila. */
  at: string;
  /** El mismo instante, legible y en la zona del usuario ("3 de agosto"). */
  day: string;
}

/**
 * Un sustantivo del manifiesto con lo que hace falta para escribirlo: sus dos
 * números y su género. Es el vocabulario del arquetipo, nunca un literal por
 * tipo de sistema.
 */
export interface Noun {
  one: string;
  many: string;
  gender: "f" | "m";
}

/**
 * Lo que el servidor mide sobre un sistema. Cada campo que puede faltar es
 * `null` en vez de un cero: "ninguna tarea pasó de fecha" y "cero" dicen cosas
 * distintas, y sólo la primera significa que ese hecho no se pinta.
 */
export interface BrainSignals {
  /** Hoy, ya escrito en la zona del usuario. Es la fecha del párrafo. */
  today: string;
  /** Cómo llama este arquetipo a sus contenedores. `null` si no los ofrece. */
  container: Noun | null;
  containerCount: number;
  /** Cómo llama este arquetipo a sus páginas ("apunte", "doc", "manuscrito"). */
  page: Noun;
  pageCount: number;
  openCount: number;
  closedCount: number;
  daysSinceCreated: number;
  overdue: { count: number; oldest: FactRow } | null;
  pileup: { column: string; count: number; oldest: FactRow; days: number } | null;
  stalled: { row: FactRow; days: number } | null;
  nextDue: { row: FactRow; inDays: number } | null;
  emptyContainers: { count: number; first: FactRow } | null;
  lastMove: { row: FactRow; days: number } | null;
  lastClosed: { row: FactRow; days: number } | null;
  observed: { minutes: number; sessions: number; last: FactRow } | null;
}

type BrainRule = SuggestionRule<BrainSignals, SystemFact>;

/** El techo de hechos. Se recorta después de ordenar, así que sobrevive lo de más peso. */
export const FACTS_MAX = 6;

/**
 * Caracteres de un título dentro de una frase. Un título es un renglón entero
 * en la fila que lo enseña, pero dentro de la razón de un hecho compite con el
 * dato, así que se cita recortado: el título completo está a un clic.
 */
const TITLE_MAX = 60;

/** El título de una fila, entrecomillado y recortado, listo para una frase. */
function cita(title: string): string {
  const limpio = title.trim();
  return `«${limpio.length > TITLE_MAX ? `${limpio.slice(0, TITLE_MAX - 1).trimEnd()}\u2026` : limpio}»`;
}

const fact = (kind: FactKind, row: FactRow, title: string, reason: string, weight: number): SystemFact => ({
  kind,
  title,
  reason,
  target: row.target,
  occurredAt: row.at,
  weight,
});

/** Lo que pasó de fecha y sigue abierto. Nada gana a esto. */
const overdue: BrainRule = ({ overdue: past }) => {
  if (!past) return null;
  const { count, oldest } = past;
  return fact(
    "overdue",
    oldest,
    count === 1 ? "Una tarea pasó de fecha" : `${count} tareas pasaron de fecha`,
    `La más vieja es ${cita(oldest.title)}, del ${oldest.day}.`,
    95,
  );
};

/** Dónde se acumula el trabajo: la columna o el estado que junta más tareas. */
const pileup: BrainRule = ({ pileup: pile }) => {
  if (!pile) return null;
  const { column, count, oldest, days } = pile;
  return fact(
    "pileup",
    oldest,
    `${count} tareas se acumulan en ${column}`,
    `La más vieja lleva ${plural(days, "día", "días")} ahí: ${cita(oldest.title)}, desde el ${oldest.day}.`,
    82,
  );
};

/** Lo que lleva más tiempo abierto sin que nadie lo toque. */
const stalled: BrainRule = ({ stalled: stuck }) => {
  if (!stuck) return null;
  const { row, days } = stuck;
  return fact(
    "stalled",
    row,
    `${cita(row.title)} lleva ${plural(days, "día", "días")} sin moverse`,
    `Es la tarea abierta que más tiempo lleva igual, desde el ${row.day}.`,
    74,
  );
};

/** Lo próximo con fecha, que es lo único de aquí que mira hacia adelante. */
const nextDue: BrainRule = ({ nextDue: next }) => {
  if (!next) return null;
  const { row, inDays } = next;
  const cuando = inDays === 0 ? "Vence hoy" : inDays === 1 ? "Vence mañana" : `Vence en ${inDays} días`;
  return fact("next-due", row, `Lo próximo es ${cita(row.title)}`, `${cuando}, el ${row.day}.`, 66);
};

/**
 * Contenedores creados y nunca llenados. Es el hecho que habla en el
 * vocabulario del arquetipo, así que un sistema sin contenedores no lo tiene.
 */
const emptyContainer: BrainRule = ({ emptyContainers: empty, container }) => {
  if (!empty || !container) return null;
  const { count, first } = empty;
  return fact(
    "empty-container",
    first,
    `${contar(count, container)} sin una sola tarea`,
    `${cita(first.title)} se creó el ${first.day} y sigue ${container.gender === "f" ? "vacía" : "vacío"}.`,
    58,
  );
};

/** La última escritura registrada, que no siempre es la última tarea cerrada. */
const lastMove: BrainRule = ({ lastMove: move }) => {
  if (!move) return null;
  const { row, days } = move;
  return fact(
    "last-move",
    row,
    `Lo último que se movió aquí fue ${cita(row.title)}`,
    days === 0
      ? "Es la última escritura registrada en este sistema, de hoy."
      : `Es la última escritura registrada en este sistema, del ${row.day}, hace ${plural(days, "día", "días")}.`,
    50,
  );
};

/** Lo último que se cerró, que es la única prueba de que el sistema entrega. */
const lastClosed: BrainRule = ({ lastClosed: closed }) => {
  if (!closed) return null;
  const { row, days } = closed;
  return fact(
    "last-closed",
    row,
    `Lo último que cerraste fue ${cita(row.title)}`,
    days === 0 ? "Hoy." : `Hace ${plural(days, "día", "días")}, el ${row.day}.`,
    46,
  );
};

/** El tiempo que de verdad se registró, no el que se estimó. */
const observedTime: BrainRule = ({ observed }) => {
  if (!observed) return null;
  const { minutes, sessions, last } = observed;
  return fact(
    "observed-time",
    last,
    `${formatMinutes(minutes)} de tiempo observado en 30 días`,
    `${plural(sessions, "sesión registrada", "sesiones registradas")}; la última sobre ${cita(last.title)}, el ${last.day}.`,
    38,
  );
};

const SYSTEM_RULES: readonly BrainRule[] = [
  overdue,
  pileup,
  stalled,
  nextDue,
  emptyContainer,
  lastMove,
  lastClosed,
  observedTime,
];

export function buildSystemFacts(signals: BrainSignals): SystemFact[] {
  return buildSuggestions(signals, SYSTEM_RULES, { limit: FACTS_MAX });
}

/**
 * Un sistema del que no hay una sola fila que citar. No es lo mismo que uno
 * tranquilo, y por eso el panel enseña un estado vacío distinto: un sistema
 * recién creado no está en calma, está sin empezar.
 */
export function isUnstarted(signals: BrainSignals): boolean {
  const { openCount, closedCount, pageCount, containerCount, observed, lastMove: move } = signals;
  return (
    openCount === 0 &&
    closedCount === 0 &&
    pageCount === 0 &&
    containerCount === 0 &&
    observed === null &&
    move === null
  );
}

/**
 * El párrafo de estado. Las cláusulas que no tienen número desaparecen, así que
 * un sistema sin contenedores y sin clases de tarea dice una frase corta en vez
 * de una frase con ceros. El vocabulario sale del manifiesto del arquetipo, no
 * de un literal por tipo de sistema.
 */
export function describeSystem(signals: BrainSignals): string {
  const { today, openCount, closedCount, container, containerCount, page, pageCount, observed } = signals;

  if (isUnstarted(signals)) {
    const edad =
      signals.daysSinceCreated === 0
        ? "se creó hoy"
        : `se creó hace ${plural(signals.daysSinceCreated, "día", "días")}`;
    return `Al ${today} este sistema está vacío: ${edad} y todavía no hay nada que contar.`;
  }

  const tiene = listar([
    openCount > 0 ? plural(openCount, "tarea viva", "tareas vivas") : null,
    closedCount > 0 ? plural(closedCount, "cerrada", "cerradas") : null,
    container && containerCount > 0 ? contar(containerCount, container) : null,
    pageCount > 0 ? contar(pageCount, page) : null,
  ]);

  // Sin una sola cifra que dar, el sistema no está sin empezar (algo se movió
  // en él) pero tampoco tiene nada que contar en números.
  const frases = [tiene ? `Al ${today} este sistema tiene ${tiene}.` : `Al ${today} este sistema no tiene ninguna tarea.`];

  if (observed) {
    frases.push(
      `El tiempo observado de los últimos 30 días suma ${formatMinutes(observed.minutes)} en ${plural(observed.sessions, "sesión", "sesiones")}.`,
    );
  }

  return frases.join(" ");
}

/** "3 tareas vivas", "1 tarea viva". El número siempre delante, que es lo que se lee. */
function plural(n: number, singular: string, many: string): string {
  return `${n.toLocaleString("es")} ${n === 1 ? singular : many}`;
}

/** Lo mismo con un sustantivo del manifiesto: "3 clases", "1 milestone". */
function contar(n: number, noun: Noun): string {
  return plural(n, noun.one, noun.many);
}

/** "a, b y c", saltándose lo que no existe. */
function listar(partes: readonly (string | null)[]): string {
  const vivas = partes.filter((parte): parte is string => parte !== null);
  if (vivas.length <= 1) return vivas[0] ?? "";
  return `${vivas.slice(0, -1).join(", ")} y ${vivas[vivas.length - 1]}`;
}

/** Minutos en la forma en que se dicen en voz alta: "45 min", "2 h", "6 h 40". */
function formatMinutes(total: number): string {
  if (total < 60) return `${total} min`;
  const horas = Math.floor(total / 60);
  const minutos = total % 60;
  return minutos === 0 ? `${horas} h` : `${horas} h ${minutos}`;
}
