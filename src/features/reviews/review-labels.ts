import { AlignLeft, BookOpenCheck, Feather, Landmark, MessageCircleQuestion, Scale, SpellCheck, type LucideIcon } from "lucide-react";
import type { ReviewCategory, ReviewComment, ReviewSeverity } from "./reviews.types";

/**
 * Las palabras de la revisión. Las categorías se enseñan en el orden en que se
 * arreglan, de la estructura a la ortografía, y la severidad se dice con una
 * palabra y con peso, no con un color: el rojo es de lo irreversible y el coral
 * de lo vencido.
 */

export const CATEGORY_ORDER: readonly ReviewCategory[] = ["structure", "argument", "evidence", "clarity", "style", "grammar"];

export const CATEGORY_LABEL: Record<ReviewCategory, string> = {
  structure: "Estructura",
  argument: "Argumento",
  evidence: "Evidencia",
  clarity: "Claridad",
  style: "Estilo",
  grammar: "Redacción",
};

export const CATEGORY_ICON: Record<ReviewCategory, LucideIcon> = {
  structure: Landmark,
  argument: Scale,
  evidence: BookOpenCheck,
  clarity: AlignLeft,
  style: Feather,
  grammar: SpellCheck,
};

export const QUESTION_ICON = MessageCircleQuestion;

export const SEVERITY_ORDER: readonly ReviewSeverity[] = ["critical", "important", "suggestion"];

export const SEVERITY_LABEL: Record<ReviewSeverity, string> = {
  critical: "Crítico",
  important: "Importante",
  suggestion: "Detalle",
};

/** En plural y en minúscula, para «quedan 2 críticos». */
const SEVERITY_PLURAL: Record<ReviewSeverity, [string, string]> = {
  critical: ["crítico", "críticos"],
  important: ["importante", "importantes"],
  suggestion: ["detalle", "detalles"],
};

export function severityCount(severity: ReviewSeverity, n: number): string {
  const [uno, varios] = SEVERITY_PLURAL[severity];
  return `${n} ${n === 1 ? uno : varios}`;
}

/** Quién firma un comentario o una respuesta. */
export function authorLabel(author: ReviewComment["author"], reviewer: string | null): string {
  if (author === "person") return "Tú";
  return reviewer ?? "Tu agente";
}

/**
 * El orden de trabajo: lo que tiene sitio en el texto va en el orden del texto;
 * dentro del mismo sitio, lo más grave primero. Lo que perdió su fragmento va
 * al final, donde no estorba a lo que sí se puede arreglar.
 */
export function workOrder(
  comments: readonly ReviewComment[],
  positions: ReadonlyMap<string, number>,
): ReviewComment[] {
  const peso = (c: ReviewComment) => (c.severity ? SEVERITY_ORDER.indexOf(c.severity) : SEVERITY_ORDER.length);
  return [...comments].sort((a, b) => {
    const pa = positions.get(a.id) ?? Number.POSITIVE_INFINITY;
    const pb = positions.get(b.id) ?? Number.POSITIVE_INFINITY;
    if (pa !== pb) return pa - pb;
    return peso(a) - peso(b);
  });
}
