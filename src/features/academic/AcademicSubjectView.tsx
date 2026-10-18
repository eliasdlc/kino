"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IndexHead } from "@/features/notebooks/IndexHead";
import { joinMeta } from "@/features/notebooks/index-format";
import type { SystemTransport } from "@/features/systems/systems.types";
import type { TaskTransport } from "@/features/tasks/tasks.types";
import { AcademicTaskViews } from "./AcademicTaskViews";
import { MoveToCycleDialog } from "./MoveToCycleMenu";
import type { AcademicPeriod } from "./academic.hooks";

export interface SubjectFolder {
  id: string;
  name: string;
  metadata: Record<string, unknown> | null;
  academicPeriodId?: string | null;
}

interface AcademicSubjectViewProps {
  system: SystemTransport;
  /** La carpeta abierta: da el nombre, el profesor y el horario. */
  folder: SubjectFolder;
  /**
   * La materia raíz. Es quien lleva el ciclo, porque una subcarpeta no puede
   * contradecir al de su clase: la mutación del backend sólo acepta la raíz.
   */
  subject: SubjectFolder;
  periods: AcademicPeriod[];
  initialTasks: TaskTransport[];
  /** Las subcarpetas y los apuntes de la clase, tal como los pinta la ruta. */
  documents: ReactNode;
}

function metaString(metadata: Record<string, unknown> | null, key: string): string | null {
  const value = metadata?.[key];
  return typeof value === "string" && value.trim() ? value : null;
}

/**
 * Una clase, entera, de un solo scroll.
 *
 * Antes esto eran tres filas de controles apiladas (el desplegable de año y
 * ciclo, las pestañas de tareas y apuntes, y las cuatro del funnel) y el
 * contenido empezaba en la cuarta pantalla. Una carpeta tiene que enseñar lo
 * que contiene: primero los apuntes, debajo las entregas.
 *
 * El ciclo es una etiqueta, no un formulario: la clase ya pertenece a uno, y
 * tocarla es lo que la mueve.
 */
export function AcademicSubjectView({ system, folder, subject, periods, initialTasks, documents }: AcademicSubjectViewProps) {
  const [moving, setMoving] = useState(false);
  const professor = metaString(folder.metadata, "professor");
  const schedule = metaString(folder.metadata, "schedule");
  const period = periods.find((candidate) => candidate._id === subject.academicPeriodId) ?? null;

  const meta = joinMeta([professor, schedule]);

  return (
    <div className="w-full space-y-7">
      <header className="grid grid-cols-[var(--margen)_1fr] md:grid-cols-[0_1fr]">
        <span aria-hidden className="flex justify-center self-start pt-1 text-muted-foreground md:hidden">
          <GraduationCap className="size-5" />
        </span>
        <div className="min-w-0 space-y-1.5">
          <h1 className="font-display text-[1.41rem] font-bold tracking-[-0.02em] wrap-anywhere">{folder.name}</h1>
          {meta && <p className="text-sm text-muted-foreground">{meta}</p>}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setMoving(true)}
            aria-label={period ? `Ciclo: ${period.name}. Mover a otro ciclo` : "Sin ciclo. Asignar un ciclo"}
          >
            {period ? period.name : "Sin ciclo"}
            <ChevronDown aria-hidden className="size-4 opacity-70" />
          </Button>
        </div>
      </header>

      {documents}

      <section aria-labelledby={`${folder.id}-entregas`} className="space-y-3">
        <IndexHead id={`${folder.id}-entregas`} title="Entregas y exámenes" />
        <AcademicTaskViews systemId={system.id} initialTasks={initialTasks} folderId={folder.id} />
      </section>

      <MoveToCycleDialog folder={subject} periods={periods} open={moving} onOpenChange={setMoving} />
    </div>
  );
}
