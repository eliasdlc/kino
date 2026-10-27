"use client";

import { useSearchParams } from "next/navigation";
import { NotebooksView } from "@/features/notebooks/NotebooksView";
import { surfaceOf, type Surface } from "./system-surfaces";
import { SystemDetailView } from "./views/SystemDetailView";
import { SystemWritingView } from "./views/SystemWritingView";
import type { SystemTransport } from "./systems.types";
import type { TaskTransport } from "@/features/tasks/tasks.types";
import type { AcademicPeriod } from "@/features/academic/academic.hooks";

export type { Surface } from "./system-surfaces";

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
 *
 * Escritura pinta sus documentos como su índice de obras y manuscritos; sus
 * tareas son el embudo de tareas de siempre, que antes no tenía puerta.
 */
export function SystemSurfaces({ system, initialTasks, landing, academic, periods }: SystemSurfacesProps) {
  const surface = surfaceOf(useSearchParams().get("tab"), landing);

  if (surface === "docs") {
    if (system.templateType === "writing") return <SystemWritingView system={system} initialTasks={initialTasks} />;
    return <NotebooksView systemId={system.id} academic={academic} periods={periods} initialTasks={initialTasks} />;
  }
  return <SystemDetailView system={system} initialTasks={initialTasks} />;
}
