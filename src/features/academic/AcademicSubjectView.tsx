"use client";

import { useState, type ReactNode } from "react";
import { CalendarClock, ChevronDown, User } from "lucide-react";
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

  return (
    <div className="w-full space-y-7">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h1 className="min-w-0 font-display text-[1.41rem] font-bold tracking-[-0.02em] wrap-anywhere">
            {folder.name}
          </h1>
          <button
            type="button"
            onClick={() => setMoving(true)}
            className="inline-flex min-h-8 shrink-0 items-center gap-1 rounded-full border border-border px-2.5 text-xs font-semibold text-primary transition-colors hover:border-primary/60"
            aria-label={period ? `Ciclo: ${period.name}. Mover a otro ciclo` : "Sin ciclo. Asignar un ciclo"}
          >
            {period ? period.name : "Sin ciclo"}
            <ChevronDown className="size-3 opacity-70" />
          </button>
        </div>
        {(professor || schedule) && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {professor && (
              <span className="inline-flex items-center gap-1.5">
                <User className="size-3.5" />
                {professor}
              </span>
            )}
            {schedule && (
              <span className="inline-flex items-center gap-1.5">
                <CalendarClock className="size-3.5" />
                {schedule}
              </span>
            )}
          </div>
        )}
      </header>

      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Apuntes</h2>
        {documents}
      </section>

      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Entregas y exámenes</h2>
        <AcademicTaskViews systemId={system.id} initialTasks={initialTasks} folderId={folder.id} />
      </section>

      <MoveToCycleDialog folder={subject} periods={periods} open={moving} onOpenChange={setMoving} />
    </div>
  );
}
