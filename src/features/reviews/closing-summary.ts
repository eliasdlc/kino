import type { ReviewProgress } from "./reviews.types";

/**
 * La frase del cierre de una pasada: cómo se cerró cada cosa. Lo que se nombra
 * primero es lo que la persona arregló con sus palabras, que es lo que vale;
 * aceptar una propuesta y descartar con criterio también cuentan, después.
 */
export function closingSummary({ closedHow }: Pick<ReviewProgress, "closedHow">): string {
  const partes: string[] = [];
  const n = (k: number, uno: string, varios: string) => `${k} ${k === 1 ? uno : varios}`;
  if (closedHow.edited > 0) partes.push(`arreglaste ${closedHow.edited} con tus palabras`);
  if (closedHow.applied > 0) partes.push(`aplicaste ${n(closedHow.applied, "propuesta", "propuestas")}`);
  if (closedHow.verified > 0) partes.push(`tu agente comprobó ${n(closedHow.verified, "arreglo", "arreglos")}`);
  if (closedHow.marked > 0) partes.push(`diste por bueno${closedHow.marked === 1 ? "" : "s"} ${closedHow.marked}`);
  if (closedHow.dismissed > 0) partes.push(`descartaste ${closedHow.dismissed}`);
  if (partes.length === 0) return "";
  const frase = partes.length === 1 ? partes[0]! : `${partes.slice(0, -1).join(", ")} y ${partes[partes.length - 1]}`;
  return `${frase.charAt(0).toUpperCase()}${frase.slice(1)}.`;
}
