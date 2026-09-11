"use client";

import { createContext, useContext } from "react";

export interface AcademicScope {
  systemId: string;
  academicPeriodId?: string | null;
  folderId?: string;
}
export const AcademicScopeContext = createContext<AcademicScope | null>(null);

/** Un filtro de navegación, nunca una copia de los datos del servidor. */
export function useAcademicScope(systemId: string) {
  const scope = useContext(AcademicScopeContext);
  return scope?.systemId === systemId ? scope : null;
}
