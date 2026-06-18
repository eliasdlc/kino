'use client';

import { Controller, type UseFormReturn } from "react-hook-form";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";
import { CalendarRange } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { ENERGY_LEVEL_VALUES, TASK_PRIORITY_VALUES } from "@/shared/types/enums";
import { cn } from "@/lib/utils";
import { getSystemColor } from "@/shared/utils/system-colors";
import { TagPicker } from "@/features/tags/TagPicker";
import type { FolderWithCounts } from "@/features/folders/folders.types";
import type { Sprint } from "@/features/sprints/sprints.types";
import { EstimatedTimePicker } from "./EstimatedTimePicker";
import { TaskTypePicker } from "./TaskTypePicker";
import type { TaskTypeConfig } from "./task-type-config";
import {
  isFieldHiddenByTaskType,
  type TaskDialogFieldKey,
} from "./task-dialog-config";
import type { FormValues } from "./CreateTaskDialog";

interface TaskPlanningFieldsProps {
  form: UseFormReturn<FormValues>;
  systemId: string;
  /** Campos visibles para este systemType, ya ordenados por prioridad. */
  fields: TaskDialogFieldKey[];
  typeConfig: TaskTypeConfig;
  taskType: FormValues['taskType'];
  folders: FolderWithCounts[];
  sprints: Sprint[];
  dateRange: DateRange;
  setDateRange: (range: DateRange) => void;
}

/**
 * Paso 2 (planificación) del CreateTaskDialog. Renderiza los campos en el orden
 * que dicta `task-dialog-config.ts` para el systemType, ocultando además los que
 * el tipo de tarea no usa. Prioridad y energía se aparean en una fila cuando
 * quedan contiguos.
 */
export function TaskPlanningFields({
  form, systemId, fields, typeConfig, taskType, folders, sprints, dateRange, setDateRange,
}: TaskPlanningFieldsProps) {
  const activeSprints = sprints.filter((s) => s.status !== 'completed');

  const priorityField = (
    <div className="space-y-2">
      <Label>Prioridad</Label>
      <Controller
        control={form.control}
        name="priority"
        render={({ field }) => (
          <Select value={field.value} onValueChange={field.onChange}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {TASK_PRIORITY_VALUES.map((p) => (
                <SelectItem key={p} value={p}>{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />
    </div>
  );

  const energyField = (
    <div className="space-y-2">
      <Label>Energía</Label>
      <Controller
        control={form.control}
        name="energyLevel"
        render={({ field }) => (
          <Select value={field.value} onValueChange={field.onChange}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {ENERGY_LEVEL_VALUES.map((e) => (
                <SelectItem key={e} value={e}>{e}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />
    </div>
  );

  function renderField(key: TaskDialogFieldKey): React.ReactNode {
    switch (key) {
      case 'priority':
        return priorityField;
      case 'energyLevel':
        return energyField;

      case 'dates':
        return (
          <div className="space-y-2">
            <Label>{taskType === 'reminder' ? 'Fecha límite' : 'Fechas'}</Label>
            {taskType === 'reminder' ? (
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start gap-2 text-sm font-normal">
                    <CalendarRange size={16} className="shrink-0 text-muted-foreground" />
                    {form.watch('dueDate')
                      ? format(new Date(form.watch('dueDate')! + 'T00:00:00'), 'MMM d, yyyy')
                      : <span className="text-muted-foreground">Seleccionar fecha</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={form.watch('dueDate') ? new Date(form.watch('dueDate')! + 'T00:00:00') : undefined}
                    onSelect={(d) => form.setValue('dueDate', d ? format(d, 'yyyy-MM-dd') : null)}
                  />
                </PopoverContent>
              </Popover>
            ) : (
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start gap-2 text-sm font-normal">
                    <CalendarRange size={16} className="shrink-0 text-muted-foreground" />
                    {dateRange.from ? (
                      dateRange.to ? (
                        <span>{format(dateRange.from, 'MMM d')} → {format(dateRange.to, 'MMM d, yyyy')}</span>
                      ) : (
                        <span>{format(dateRange.from, 'MMM d, yyyy')} <span className="text-muted-foreground">→ sin fin</span></span>
                      )
                    ) : (
                      <span className="text-muted-foreground">Seleccionar fechas</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="range"
                    selected={dateRange}
                    onSelect={(range) => {
                      const r = range ?? { from: undefined, to: undefined };
                      setDateRange(r);
                      form.setValue('startDate', r.from ? format(r.from, 'yyyy-MM-dd') : null);
                      form.setValue('dueDate', r.to ? format(r.to, 'yyyy-MM-dd') : null);
                    }}
                    numberOfMonths={1}
                  />
                  {(dateRange.from || dateRange.to) && (
                    <div className="p-2 border-t">
                      <Button variant="ghost" size="sm" className="w-full" onClick={() => {
                        setDateRange({ from: undefined, to: undefined });
                        form.setValue('startDate', null);
                        form.setValue('dueDate', null);
                      }}>
                        Limpiar
                      </Button>
                    </div>
                  )}
                </PopoverContent>
              </Popover>
            )}

            {/* Horas opcionales (default sin hora) */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              {taskType !== 'reminder' && (
                <div className="space-y-1">
                  <Label htmlFor="start-time" className="text-xs text-muted-foreground">Hora inicio</Label>
                  <Input
                    id="start-time"
                    type="time"
                    disabled={!form.watch('startDate')}
                    {...form.register('startTime')}
                    className="h-9 text-sm"
                  />
                </div>
              )}
              <div className={cn("space-y-1", taskType === 'reminder' && "col-span-2")}>
                <Label htmlFor="due-time" className="text-xs text-muted-foreground">Hora vencimiento</Label>
                <Input
                  id="due-time"
                  type="time"
                  disabled={!form.watch('dueDate')}
                  {...form.register('dueTime')}
                  className="h-9 text-sm"
                />
              </div>
            </div>

            {form.formState.errors.startDate && (
              <p className="text-xs text-destructive">{form.formState.errors.startDate.message}</p>
            )}
            {form.formState.errors.dueDate && (
              <p className="text-xs text-destructive">{form.formState.errors.dueDate.message}</p>
            )}
          </div>
        );

      case 'estimatedMinutes':
        return (
          <div className="space-y-2">
            <Label>Tiempo estimado</Label>
            <Controller
              control={form.control}
              name="estimatedMinutes"
              render={({ field }) => (
                <EstimatedTimePicker value={field.value} onChange={field.onChange} />
              )}
            />
          </div>
        );

      case 'folder':
        if (folders.length === 0) return null;
        return (
          <div className="space-y-2">
            <Label>Carpeta</Label>
            <Controller
              control={form.control}
              name="folderId"
              render={({ field }) => (
                <Select value={field.value ?? 'none'} onValueChange={(v) => field.onChange(v === 'none' ? null : v)}>
                  <SelectTrigger><SelectValue placeholder="Sin carpeta" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none"><span className="text-muted-foreground">Sin carpeta</span></SelectItem>
                    {folders.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        <span className="flex items-center gap-2">
                          <span className={`size-2 rounded-full inline-block bg-${getSystemColor(f.color)}`} />
                          {f.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
        );

      case 'tag':
        return (
          <Controller
            control={form.control}
            name="contextTagId"
            render={({ field }) => (
              <TagPicker
                systemId={systemId}
                value={field.value}
                onChange={field.onChange}
                label="Categoría"
                allowCreate
              />
            )}
          />
        );

      case 'sprint':
        if (activeSprints.length === 0) return null;
        return (
          <div className="space-y-2">
            <Label>Sprint</Label>
            <Controller
              control={form.control}
              name="sprintId"
              render={({ field }) => (
                <Select value={field.value ?? 'none'} onValueChange={(v) => field.onChange(v === 'none' ? null : v)}>
                  <SelectTrigger><SelectValue placeholder="Sin sprint" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none"><span className="text-muted-foreground">Sin sprint</span></SelectItem>
                    {activeSprints.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
        );

      default:
        return null;
    }
  }

  // Campos efectivos: visibles para el systemType y no ocultos por el tipo de tarea.
  const visible = fields.filter((f) => !isFieldHiddenByTaskType(f, typeConfig));

  const rows: React.ReactNode[] = [];
  for (let i = 0; i < visible.length; i++) {
    const f = visible[i];
    const next = visible[i + 1];
    const isPair =
      (f === 'priority' && next === 'energyLevel') ||
      (f === 'energyLevel' && next === 'priority');
    if (isPair) {
      rows.push(
        <div key={`${f}-${next}`} className="grid grid-cols-2 gap-3">
          {renderField(f)}
          {renderField(next)}
        </div>,
      );
      i++;
    } else {
      rows.push(<div key={f}>{renderField(f)}</div>);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Type picker (siempre visible: gobierna el ocultado por tipo de tarea) */}
      <div className="space-y-2">
        <Label>Tipo</Label>
        <Controller
          control={form.control}
          name="taskType"
          render={({ field }) => (
            <TaskTypePicker
              value={field.value ?? undefined}
              onChange={(val) => field.onChange(val ?? null)}
            />
          )}
        />
      </div>

      {rows}
    </div>
  );
}
