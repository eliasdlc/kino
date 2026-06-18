"use client";

import { DefaultTaskCard } from "./DefaultTaskCard";
import type { TaskCardProps } from "./types";

/**
 * Personal — por ahora usa la fila genérica con su metadata por-tipo (why…).
 * Punto de extensión: layout propio cuando haya diseño.
 */
export function PersonalTaskCard(props: TaskCardProps) {
  return <DefaultTaskCard {...props} systemType="personal" />;
}
