import { format } from "date-fns";
import { es } from "date-fns/locale";
import { formatCount } from "@/features/notebooks/index-format";
import type { SystemSignals } from "./systems.signals";

/**
 * Las tres lecturas de la cabecera de un sistema: una cifra en Bricolage y la
 * palabra que la explica. Puro, para probar qué dice cada arquetipo sin montar
 * la cabecera. Una lectura sin dato no se pinta: nada vacío ocupa espacio.
 * El coral (`warn`) sólo va cuando la palabra dice el estado ("dormido").
 */
export interface Reading {
  value: string;
  label: string;
  tone?: "warn";
}

/** Lo que dicen las señales de cualquier sistema: activas, próxima entrega y días sin actividad. */
export function signalReadings(signals: SystemSignals): Reading[] {
  const readings: Reading[] = [
    { value: formatCount(signals.activeTaskCount), label: signals.activeTaskCount === 1 ? "activa" : "activas" },
  ];
  if (signals.nextDueDate) {
    readings.push({
      value: format(new Date(signals.nextDueDate), "d MMM", { locale: es }).replace(".", ""),
      label: "próxima entrega",
    });
  }
  const dias = signals.daysSinceLastActivity;
  if (dias !== null) {
    if (signals.stale) readings.push({ value: formatCount(dias), label: "días dormido", tone: "warn" });
    else if (dias === 0) readings.push({ value: "hoy", label: "última hecha" });
    else readings.push({ value: formatCount(dias), label: dias === 1 ? "día sin actividad" : "días sin actividad" });
  }
  return readings;
}

/** Escritura: palabras de hoy, lo escrito contra la meta y los días sin sesión. */
export function writingReadings(input: {
  wordsToday: number;
  totalWords: number;
  /** La suma de las metas de sus obras; null si ninguna tiene. */
  wordGoal: number | null;
  /** Los días de la obra más reciente; null si nunca hubo sesión. */
  daysSinceSession: number | null;
  /** Desde cuántos días se dice dormido. */
  staleAfter: number;
}): Reading[] {
  const readings: Reading[] = [
    { value: formatCount(input.wordsToday), label: "palabras hoy" },
    input.wordGoal
      ? { value: formatCount(input.totalWords), label: `de ${formatCount(input.wordGoal)}` }
      : { value: formatCount(input.totalWords), label: "palabras en total" },
  ];
  const dias = input.daysSinceSession;
  if (dias !== null) {
    readings.push(
      dias >= input.staleAfter
        ? { value: formatCount(dias), label: "días dormido", tone: "warn" }
        : { value: formatCount(dias), label: dias === 1 ? "día sin sesión" : "días sin sesión" },
    );
  }
  return readings;
}
