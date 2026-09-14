"use client";

import { useMemo, type ReactNode } from "react";
import { AcademicScopeContext } from "./academic-scope";
import { useSelectedCycle, type AcademicPeriod } from "./academic.hooks";

interface AcademicWorkspaceProps {
  systemId: string;
  /** Dentro de una clase el scope es la clase, no el ciclo. */
  folderId?: string;
  initialPeriods?: AcademicPeriod[];
  children: ReactNode;
}

/**
 * El scope académico y nada más: qué ciclo o qué clase está mirando la persona,
 * para que las listas de tareas y de apuntes filtren por lo mismo.
 *
 * No pinta interfaz. El control de año y ciclo vive en la cabecera del sistema
 * (`CyclePicker`), y este proveedor nunca esconde a sus hijos detrás de un
 * skeleton: lo que el servidor ya renderizó se ve desde el primer pintado.
 */
export function AcademicWorkspace({ systemId, folderId, initialPeriods, children }: AcademicWorkspaceProps) {
  const { selectedId } = useSelectedCycle(systemId, initialPeriods, !folderId);
  const scope = useMemo(
    () => (folderId ? { systemId, folderId } : { systemId, academicPeriodId: selectedId }),
    [systemId, folderId, selectedId],
  );
  return <AcademicScopeContext.Provider value={scope}>{children}</AcademicScopeContext.Provider>;
}
