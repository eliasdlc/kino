"use client";

import { DefaultTaskCard } from "./DefaultTaskCard";
import type { TaskCardProps } from "./types";

/**
 * Emprendimiento — por ahora usa la fila genérica con su metadata por-tipo
 * (milestone, kpi…). Punto de extensión: layout propio cuando haya diseño.
 */
export function EntrepreneurialTaskCard(props: TaskCardProps) {
  return <DefaultTaskCard {...props} systemType="entrepreneurial" />;
}
