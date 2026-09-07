"use client";

import { format } from "date-fns";
import { CalendarIcon, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { TimePicker } from "@/components/ui/time-picker";
import type { TaskTransport } from "./tasks.types";
import { formatDuration, hasDueTime, taskJsonFilename, withDay, withTime } from "./task-detail.helpers";
import { api } from "@convex/_generated/api";
import { useConvexQuery } from "@/shared/convex/hooks";
import { getConvexClient } from "@/shared/convex/client";

/**
 * Bloques del panel de detalle de tarea (KIN-146 · FE-05).
 * Extraídos de `TaskDetailSheet` tal cual. `DateTimeField` unifica los dos
 * selectores de fecha, que eran el mismo bloque duplicado palabra por palabra.
 */

export function TimeLoggedSection({ taskId }: { taskId: string }) {
  const { data } = useConvexQuery(api.tasks.timeLogSummary, { id: taskId });

  if (!data || data.sessionCount === 0) return null;

  return (
    <div className="mt-4 pt-4 border-t">
      <p className="text-xs text-muted-foreground mb-1">Tiempo registrado</p>
      <p className="text-sm font-medium">
        {formatDuration(data.totalMinutes)}
        <span className="text-muted-foreground font-normal"> · {data.sessionCount} sesión{data.sessionCount !== 1 ? 'es' : ''}</span>
      </p>
    </div>
  );
}

export function DateTimeField({
  label,
  timeInputId,
  value,
  onChange,
}: {
  label: string;
  timeInputId: string;
  value: Date | undefined;
  onChange: (updater: (prev: Date | undefined) => Date | undefined) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="w-full min-w-0 justify-start gap-2 text-sm font-normal">
            <CalendarIcon size={16} className="shrink-0 text-muted-foreground" />
            {value ? (
              <span className="truncate">
                {format(value, "MMM d, yyyy")}
                {hasDueTime(value) && <span className="text-muted-foreground"> · {format(value, "HH:mm")}</span>}
              </span>
            ) : (
              <span className="truncate text-muted-foreground">Elegir fecha</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar mode="single" selected={value} onSelect={(day) => onChange((prev) => withDay(prev, day))} />
          {value && (
            <div className="p-2 border-t space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor={timeInputId} className="text-xs text-muted-foreground shrink-0">Hora</Label>
                <TimePicker
                  id={timeInputId}
                  value={format(value, "HH:mm")}
                  onChange={(val) => onChange((prev) => withTime(prev, val))}
                  className="h-8"
                />
              </div>
              <Button variant="ghost" size="sm" className="w-full" onClick={() => onChange(() => undefined)}>
                Limpiar
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}

/** Calificación de un evento académico ya completado (examen, quiz, práctica). */
export function GradeField({
  metadata,
  onChange,
}: {
  metadata: Record<string, unknown> | null;
  onChange: (next: Record<string, unknown> | null) => void;
}) {
  return (
    <div className="space-y-1.5 p-3 rounded-lg bg-task-done/10 border border-task-done/20">
      <Label className="text-task-done font-medium">Calificación obtenida</Label>
      <Input
        type="number"
        min={0}
        max={100}
        value={(metadata?.grade as string | number) || ""}
        onChange={(e) => {
          const val = e.target.value;
          const newMetadata: Record<string, unknown> = { ...metadata };
          if (val === "") {
            delete newMetadata.grade;
          } else {
            newMetadata.grade = Number(val);
          }
          onChange(Object.keys(newMetadata).length ? newMetadata : null);
        }}
        placeholder="Ej: 95"
        className="w-full bg-background"
      />
    </div>
  );
}

/** Descarga la tarea y sus subtareas como JSON. */
export function ExportTaskJsonButton({ task }: { task: TaskTransport }) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className="gap-1.5 text-muted-foreground"
      onClick={async () => {
        const subtasks = await getConvexClient().query(api.tasks.subtasks, { id: task.id }).catch(() => []);
        const payload = { ...task, subtasks };
        const blob = new Blob([JSON.stringify(payload, null, 2)], {
          type: "application/json;charset=utf-8",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = taskJsonFilename(task.title);
        a.click();
        URL.revokeObjectURL(url);
      }}
    >
      <Download size={14} />
      JSON
    </Button>
  );
}
