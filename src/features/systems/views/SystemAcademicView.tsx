"use client";

import { useAcademicScope } from "@/features/academic/academic-scope";
import { AcademicTaskViews } from "@/features/academic/AcademicTaskViews";
import type { SystemViewProps } from "./SystemDetailView";

/**
 * Academic. El semestre con el alma de Kino: foco con runway por defecto
 * (Esta semana), calendario como zoom-out, y el funnel de planificación y
 * archivo reutilizado. El headspace lo da abrir en "Esta semana".
 *
 * Las clases no son una pestaña de aquí: son lo primero de la superficie de
 * apuntes, y tener dos listas de clases era la misma pantalla dos veces.
 */
export function SystemAcademicView({ system, initialTasks }: SystemViewProps) {
  const folderId = useAcademicScope(system.id)?.folderId;
  return <AcademicTaskViews systemId={system.id} initialTasks={initialTasks} folderId={folderId} />;
}
