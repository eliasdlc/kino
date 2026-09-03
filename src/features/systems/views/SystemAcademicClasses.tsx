"use client";

import { useFolders } from "@/features/folders/folders.hooks";
import { NewFolderInline } from "@/features/folders/NewFolderInline";
import { SYSTEM_TYPE_CONFIG } from "@/shared/lib/system-types";
import { BookOpen, CalendarClock, GraduationCap, User } from "lucide-react";
import type { TaskTransport } from "@/features/tasks/tasks.types";

const folderRole = SYSTEM_TYPE_CONFIG.academic.folderRole!;

/** Próxima entrega = la tarea pendiente con dueDate más cercano en la clase. */
function nextDeadline(tasks: TaskTransport[]): string | null {
  const upcoming = tasks
    .filter((t) => t.status !== "done" && !t.deletedAt && t.dueDate)
    .map((t) => Date.parse(t.dueDate as string))
    .filter((ms) => !Number.isNaN(ms))
    .sort((a, b) => a - b);
  if (upcoming.length === 0) return null;
  return new Date(upcoming[0]).toLocaleDateString("es", { day: "numeric", month: "short" });
}

function ClassCard({ name, meta, tasks }: {
  name: string;
  meta: Record<string, unknown> | null;
  tasks: TaskTransport[];
}) {
  const professor = typeof meta?.professor === "string" ? meta.professor : null;
  const schedule = typeof meta?.schedule === "string" ? meta.schedule : null;
  const semester = typeof meta?.semester === "string" ? meta.semester : null;
  const deadline = nextDeadline(tasks);
  const pending = tasks.filter((t) => t.status !== "done" && !t.deletedAt).length;

  return (
    <div className="rounded-xl border bg-muted/20 p-4 space-y-2">
      <div className="flex items-center gap-2">
        <BookOpen size={16} className="shrink-0 text-primary" />
        <span className="font-semibold truncate">{name}</span>
        {semester && (
          <span className="ml-auto shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
            {semester}
          </span>
        )}
      </div>

      {(professor || schedule) && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 pl-6 text-xs text-muted-foreground">
          {professor && (
            <span className="inline-flex items-center gap-1">
              <User size={12} /> {professor}
            </span>
          )}
          {schedule && (
            <span className="inline-flex items-center gap-1">
              <CalendarClock size={12} /> {schedule}
            </span>
          )}
        </div>
      )}

      <div className="flex items-center gap-3 pl-6 text-xs">
        <span className="text-muted-foreground">{pending} pendiente{pending === 1 ? "" : "s"}</span>
        {deadline && (
          <span className="font-medium text-foreground">Próxima entrega: {deadline}</span>
        )}
      </div>
    </div>
  );
}

/**
 * Vista de clases del arquetipo Academic: los folders hablan su idioma. Cada
 * clase agrupa sus tareas, muestra profesor/horario/semestre (metadata) y su
 * próxima entrega. Crear una clase captura esos campos vía el manifiesto.
 */
export function SystemAcademicClasses({ systemId, tasks }: { systemId: string; tasks: TaskTransport[] }) {
  const { data: folders = [] } = useFolders(systemId);

  return (
    <div className="space-y-4">
      <NewFolderInline
        systemId={systemId}
        label={folderRole.newLabel}
        placeholder={folderRole.placeholder}
        icon={folderRole.icon}
        fields={folderRole.fields}
      />

      {folders.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center space-y-2">
          <GraduationCap className="mx-auto size-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            Crea una clase para agrupar sus entregas, exámenes y apuntes.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {folders.map((folder) => (
            <ClassCard
              key={folder.id}
              name={folder.name}
              meta={folder.metadata}
              tasks={tasks.filter((t) => t.folderId === folder.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
