"use client";

import { DefaultTaskCard } from "./DefaultTaskCard";
import type { TaskCardProps } from "./types";

/**
 * Académico — por ahora usa la fila genérica con su metadata por-tipo (course,
 * professor…). Punto de extensión: dale un layout propio cuando haya diseño.
 */
export function AcademicTaskCard(props: TaskCardProps) {
  return <DefaultTaskCard {...props} systemType="academic" />;
}
