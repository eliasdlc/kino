"use client";

import { useSearchParams } from "next/navigation";
import { NotebooksView } from "@/features/notebooks/NotebooksView";
import { SystemDetailView } from "./views/SystemDetailView";
import type { SystemTransport } from "./systems.types";
import type { TaskTransport } from "@/features/tasks/tasks.types";
import type { AcademicPeriod } from "@/features/academic/academic.hooks";

export type Surface = "tasks" | "docs";

/** La superficie que pide la URL, o la que el sistema abre por composición. */
export function surfaceOf(tab: string | null | undefined, landing: Surface): Surface {
  return tab === "docs" ? "docs" : tab === "tasks" ? "tasks" : landing;
}

interface SystemSurfacesProps {
  system: SystemTransport;
  initialTasks: TaskTransport[];
  landing: Surface;
  academic: boolean;
  periods: AcademicPeriod[];
}

/**
 * Las dos superficies de un sistema, tareas y documentos, en el cliente.
 *
 * Antes eran dos enlaces a `?tab=`: como sólo cambia el search param del mismo
 * segmento, `loading.tsx` no entra y React deja la pantalla vieja montada y
 * congelada durante todo el viaje al servidor. Cambiar de superficie no es
 * cambiar de página, así que no lo pide.
 */
export function SystemSurfaces({ system, initialTasks, landing, academic, periods }: SystemSurfacesProps) {
  const surface = surfaceOf(useSearchParams().get("tab"), landing);

  if (surface === "docs") {
    return <NotebooksView systemId={system.id} academic={academic} periods={periods} initialTasks={initialTasks} />;
  }
  return <SystemDetailView system={system} initialTasks={initialTasks} />;
}
