/**
 * Cómo se llaman los ciclos de un año académico y en qué orden vienen.
 *
 * Un ciclo no se escribe a mano: el sistema declara una cadencia (en qué meses
 * empieza cada ciclo) y de ahí sale la lista completa de candidatos, con el
 * nombre que usa el portal de la universidad. En PUCMM son tres al año, que
 * empiezan en septiembre, enero y abril.
 *
 * El primer mes de la cadencia abre el año académico: un ciclo anterior a ese
 * mes pertenece al año que empezó el septiembre pasado.
 */

const MONTHS = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
] as const;

export interface CycleCadence {
  id: string;
  label: string;
  /** Meses (1 a 12) en que empieza cada ciclo, el primero abre el año académico. */
  startMonths: number[];
}

/**
 * Las cadencias que Kino ofrece. La primera es la de PUCMM y es el default de
 * un sistema académico nuevo; las otras dos cubren los dos calendarios que se
 * repiten en el resto de universidades.
 */
export const CYCLE_CADENCES: CycleCadence[] = [
  { id: "tres", label: "3 ciclos al año", startMonths: [9, 1, 4] },
  { id: "dos", label: "2 semestres al año", startMonths: [8, 1] },
  { id: "cuatro", label: "4 trimestres al año", startMonths: [9, 1, 4, 7] },
];

export const DEFAULT_CADENCE = CYCLE_CADENCES[0];

/** La cadencia guardada en el sistema, o la de PUCMM si no hay ninguna. */
export function resolveCadence(startMonths: number[] | null | undefined): CycleCadence {
  if (!startMonths || startMonths.length === 0) return DEFAULT_CADENCE;
  const known = CYCLE_CADENCES.find(
    (candidate) =>
      candidate.startMonths.length === startMonths.length &&
      candidate.startMonths.every((month, index) => month === startMonths[index]),
  );
  return known ?? { id: "propia", label: "Cadencia propia", startMonths };
}

/** El nombre visible de un ciclo, igual que lo escribe el portal: "Septiembre de 2026". */
export function cycleName(month: number, year: number): string {
  return `${MONTHS[month - 1]} de ${year}`;
}

/**
 * El año académico al que pertenece un ciclo. El mes que abre la cadencia
 * arranca el año; todo lo anterior cuelga del año que empezó antes.
 */
export function academicYear(month: number, year: number, opener: number): string {
  const start = month >= opener ? year : year - 1;
  return `${start}-${start + 1}`;
}

export interface CycleCandidate {
  /** Año académico, tal como se guarda en `academicPeriods.year`. */
  year: string;
  /** Nombre del ciclo, tal como se guarda en `academicPeriods.name`. */
  name: string;
  month: number;
  calendarYear: number;
  /** El ciclo que contiene la fecha de referencia. */
  isCurrent: boolean;
}

/** Primer día del ciclo, en hora local. */
function startOf(month: number, year: number) {
  return new Date(year, month - 1, 1).getTime();
}

/**
 * Los ciclos de la cadencia alrededor de una fecha: dos años hacia atrás y uno
 * hacia adelante, en orden cronológico inverso (lo más nuevo primero), que es
 * el orden en que se eligen.
 */
export function generateCycles(
  cadence: CycleCadence,
  reference: Date = new Date(),
  span: { back?: number; forward?: number } = {},
): CycleCandidate[] {
  const back = span.back ?? 2;
  const forward = span.forward ?? 1;
  const opener = cadence.startMonths[0];
  const base = reference.getFullYear();
  const now = reference.getTime();

  const all: Omit<CycleCandidate, "isCurrent">[] = [];
  for (let year = base - back; year <= base + forward; year++) {
    for (const month of cadence.startMonths) {
      all.push({ year: academicYear(month, year, opener), name: cycleName(month, year), month, calendarYear: year });
    }
  }
  all.sort((a, b) => startOf(b.month, b.calendarYear) - startOf(a.month, a.calendarYear));

  // El actual es el último que ya empezó. Sin ninguno empezado no hay actual.
  const currentIndex = all.findIndex((candidate) => startOf(candidate.month, candidate.calendarYear) <= now);
  return all.map((candidate, index) => ({ ...candidate, isCurrent: index === currentIndex }));
}

/**
 * Los candidatos que todavía no existen en el sistema. Comparar por nombre y
 * año en minúscula es lo mismo que hace `academicPeriods.create` para rechazar
 * un duplicado, así que la lista nunca ofrece algo que el backend va a negar.
 */
export function availableCycles(
  cadence: CycleCadence,
  existing: { year: string; name: string }[],
  reference: Date = new Date(),
): CycleCandidate[] {
  const taken = new Set(existing.map((period) => `${period.year.toLowerCase()}|${period.name.toLowerCase()}`));
  return generateCycles(cadence, reference).filter(
    (candidate) => !taken.has(`${candidate.year.toLowerCase()}|${candidate.name.toLowerCase()}`),
  );
}

/**
 * Qué ciclo está mirando la persona. Manda la URL; sin ella, el ciclo actual;
 * y `unassigned` es una elección explícita de ver lo que no tiene ciclo.
 *
 * Vive aquí y no en los hooks porque el servidor la necesita: la ruta resuelve
 * el mismo ciclo que el cliente para pedir las tareas con los mismos
 * argumentos, que es lo que hace que su render sirva como `initialData`.
 */
export function resolveSelectedCycle<T extends { _id: string; isCurrent: boolean }>(
  periods: T[],
  requested: string | null,
): string | null {
  if (requested === "unassigned") return null;
  const asked = periods.find((period) => period._id === requested);
  if (asked) return asked._id;
  return periods.find((period) => period.isCurrent)?._id ?? null;
}
