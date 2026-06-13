"use client";

import { useEffect, useRef, useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { format } from "date-fns";
import { parseDueDate } from "./tasks.utils";
import { CalendarIcon, Timer } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Separator } from "@/components/ui/separator";
import {
  ENERGY_LEVEL_VALUES,
  TASK_PRIORITY_VALUES,
} from "@/shared/types/enums";
import type { TaskTypeValue } from "@/shared/types/enums";
import { SubtaskList } from "./SubtaskList";
import { TaskRemindersSection } from "./TaskRemindersSection";
import { useUpdateTask } from "./tasks.hooks";
import { useFolders } from "@/features/folders/folders.hooks";
import { getSystemColor } from "@/shared/utils/system-colors";
import { TaskTypePicker } from "./TaskTypePicker";
import type { Task } from "./tasks.types";
import { useFocusTimer } from "./FocusTimerProvider";
import { useQuery } from "@tanstack/react-query";

interface TaskDetailSheetProps {
  task: Task | null;
  systemId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PRIORITY_LABELS: Record<string, string> = {
  critical: "Crítica",
  high: "Alta",
  medium: "Media",
  low: "Baja",
};

const ENERGY_LABELS: Record<string, string> = {
  high: "Alta",
  medium: "Media",
  low: "Baja",
};

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

function TimeLoggedSection({ taskId }: { taskId: string }) {
  const { data } = useQuery<{ totalMinutes: number; sessionCount: number }>({
    queryKey: ['time-logs', taskId],
    queryFn: () => fetch(`/api/tasks/${taskId}/time-logs`).then((r) => r.json()),
    staleTime: 5 * 60_000,
  });

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

/** true si dueDate tiene hora significativa (no medianoche local). */
function hasDueTime(d: Date): boolean {
  return d.getHours() !== 0 || d.getMinutes() !== 0;
}

/** Cambia el día conservando la hora previa (Calendar devuelve medianoche). */
function withDay(prev: Date | undefined, day: Date | undefined): Date | undefined {
  if (!day) return undefined;
  const next = new Date(day);
  if (prev) next.setHours(prev.getHours(), prev.getMinutes(), 0, 0);
  return next;
}

/** Aplica una hora "HH:mm" al Date actual. */
function withTime(prev: Date | undefined, value: string): Date | undefined {
  if (!prev || !value) return prev;
  const [h, m] = value.split(":").map(Number);
  const next = new Date(prev);
  next.setHours(h ?? 0, m ?? 0, 0, 0);
  return next;
}

interface TaskDetailFormProps {
  task: Task;
  systemId: string;
  onClose: () => void;
}

function TaskDetailForm({ task, systemId, onClose }: TaskDetailFormProps) {
  const isMobile = useIsMobile();
  const { mutate: updateTask, isPending } = useUpdateTask(systemId);
  const { data: folders = [] } = useFolders(systemId);

  const { state: timerState, openModeDialog } = useFocusTimer();
  const isThisRunning = timerState.taskId === task.id && timerState.phase !== 'idle';
  const anotherRunning = timerState.phase !== 'idle' && !isThisRunning;
  const isDone = task.status === "done" || task.status === "archived";

  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");
  const [priority, setPriority] = useState<Task["priority"]>(task.priority);
  const [energyLevel, setEnergyLevel] = useState<Task["energyLevel"]>(task.energyLevel);
  const [taskType, setTaskType] = useState<TaskTypeValue | undefined>(
    (task.taskType && ['task', 'idea', 'event', 'reminder'].includes(task.taskType))
      ? (task.taskType as TaskTypeValue)
      : undefined
  );
  const [dueDate, setDueDate] = useState<Date | undefined>(
    task.dueDate ? parseDueDate(task.dueDate) : undefined
  );
  const [startDate, setStartDate] = useState<Date | undefined>(
    task.startDate ? parseDueDate(task.startDate) : undefined
  );
  const [selectedFolderId, setSelectedFolderId] = useState<string>(task.folderId ?? "none");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved">("idle");

  const isMountedRef = useRef(false);
  const updateTaskRef = useRef(updateTask);
  updateTaskRef.current = updateTask;

  /**
   * Solo los campos que cambiaron respecto al `task` original. Un único builder
   * usado por autosave y "Guardar y cerrar":
   *  - dueDate siempre como ISO (conserva hora; antes el botón truncaba a día).
   *  - limpiar una fecha existente manda `null` (antes omitía → DB nunca limpiaba).
   *  - no incluir dueDate cuando no cambió evita el reset de recordatorios/flags
   *    en cada tecla.
   */
  function buildDirtyData(): import("./tasks.types").UpdateTaskInput {
    const data: import("./tasks.types").UpdateTaskInput = {};

    const trimmedTitle = title.trim();
    if (trimmedTitle !== task.title) data.title = trimmedTitle;
    if (description !== (task.description ?? "")) data.description = description || undefined;
    if (priority !== task.priority) data.priority = priority;
    if (energyLevel !== task.energyLevel) data.energyLevel = energyLevel;

    const curType = taskType ?? null;
    if (curType !== (task.taskType ?? null)) data.taskType = curType;

    const curDue = dueDate ? dueDate.toISOString() : null;
    const origDue = task.dueDate ? parseDueDate(task.dueDate).toISOString() : null;
    if (curDue !== origDue) data.dueDate = curDue;

    // startDate como ISO (conserva hora), igual que dueDate.
    const curStart = startDate ? startDate.toISOString() : null;
    const origStart = task.startDate ? parseDueDate(task.startDate).toISOString() : null;
    if (curStart !== origStart) data.startDate = curStart;

    const curFolder = selectedFolderId !== "none" ? selectedFolderId : null;
    if (curFolder !== (task.folderId ?? null)) data.folderId = curFolder;

    return data;
  }

  useEffect(() => {
    if (!isMountedRef.current) {
      isMountedRef.current = true;
      return;
    }
    if (!title.trim()) return;

    setSaveStatus("idle");
    const timer = setTimeout(() => {
      const data = buildDirtyData();
      if (Object.keys(data).length === 0) return;
      updateTaskRef.current(
        { taskId: task.id, data },
        { onSuccess: () => setSaveStatus("saved") }
      );
    }, 1500);

    return () => clearTimeout(timer);
  // task.id is stable for the lifetime of this form instance (key={task.id} in parent)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, description, priority, energyLevel, taskType, dueDate, startDate, selectedFolderId]);

  function handleSave() {
    if (!title.trim()) return;
    const data = buildDirtyData();
    if (Object.keys(data).length === 0) {
      onClose();
      return;
    }
    updateTask({ taskId: task.id, data }, { onSuccess: onClose });
  }

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="space-y-1.5">
        <Label htmlFor="task-title">Título</Label>
        <Input
          id="task-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={500}
          // En mobile el autofocus abre el teclado al entrar a *ver* la
          // tarea y tapa media pantalla; solo tiene sentido con teclado físico.
          autoFocus={!isMobile}
        />
      </div>

      <div className="space-y-1.5">
        <Label>Tipo</Label>
        <TaskTypePicker value={taskType} onChange={setTaskType} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="task-desc">Descripción</Label>
        <Textarea
          id="task-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Notas opcionales..."
          className="resize-none min-h-[80px]"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Prioridad</Label>
          <Select value={priority} onValueChange={(v) => setPriority(v as Task["priority"])}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TASK_PRIORITY_VALUES.map((p) => (
                <SelectItem key={p} value={p}>{PRIORITY_LABELS[p]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Energía</Label>
          <Select value={energyLevel} onValueChange={(v) => setEnergyLevel(v as Task["energyLevel"])}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ENERGY_LEVEL_VALUES.map((e) => (
                <SelectItem key={e} value={e}>{ENERGY_LABELS[e]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {folders.length > 0 && (
        <div className="space-y-1.5">
          <Label>Asignar a</Label>
          <Select value={selectedFolderId} onValueChange={setSelectedFolderId}>
            <SelectTrigger>
              <SelectValue placeholder="Sin carpeta" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">
                <span className="text-muted-foreground">Sin carpeta</span>
              </SelectItem>
              {folders.map((folder) => (
                <SelectItem key={folder.id} value={folder.id}>
                  <span className="flex items-center gap-2">
                    <span className={`size-2 rounded-full inline-block bg-${getSystemColor(folder.color)}`} />
                    {folder.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Fecha de inicio</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full min-w-0 justify-start gap-2 text-sm font-normal">
                <CalendarIcon size={16} className="shrink-0 text-muted-foreground" />
                {startDate ? (
                  <span className="truncate">
                    {format(startDate, "MMM d, yyyy")}
                    {hasDueTime(startDate) && <span className="text-muted-foreground"> · {format(startDate, "HH:mm")}</span>}
                  </span>
                ) : (
                  <span className="truncate text-muted-foreground">Elegir fecha</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={startDate} onSelect={(day) => setStartDate((prev) => withDay(prev, day))} />
              {startDate && (
                <div className="p-2 border-t space-y-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="start-time" className="text-xs text-muted-foreground shrink-0">Hora</Label>
                    <Input
                      id="start-time"
                      type="time"
                      value={format(startDate, "HH:mm")}
                      onChange={(e) => setStartDate((prev) => withTime(prev, e.target.value))}
                      className="h-8"
                    />
                  </div>
                  <Button variant="ghost" size="sm" className="w-full" onClick={() => setStartDate(undefined)}>
                    Limpiar
                  </Button>
                </div>
              )}
            </PopoverContent>
          </Popover>
        </div>

        <div className="space-y-1.5">
          <Label>Fecha de vencimiento</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full min-w-0 justify-start gap-2 text-sm font-normal">
                <CalendarIcon size={16} className="shrink-0 text-muted-foreground" />
                {dueDate ? (
                  <span className="truncate">
                    {format(dueDate, "MMM d, yyyy")}
                    {hasDueTime(dueDate) && <span className="text-muted-foreground"> · {format(dueDate, "HH:mm")}</span>}
                  </span>
                ) : (
                  <span className="truncate text-muted-foreground">Elegir fecha</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={dueDate} onSelect={(day) => setDueDate((prev) => withDay(prev, day))} />
              {dueDate && (
                <div className="p-2 border-t space-y-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="due-time" className="text-xs text-muted-foreground shrink-0">Hora</Label>
                    <Input
                      id="due-time"
                      type="time"
                      value={format(dueDate, "HH:mm")}
                      onChange={(e) => setDueDate((prev) => withTime(prev, e.target.value))}
                      className="h-8"
                    />
                  </div>
                  <Button variant="ghost" size="sm" className="w-full" onClick={() => setDueDate(undefined)}>
                    Limpiar
                  </Button>
                </div>
              )}
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <Separator />

      <div className="space-y-2">
        <Label>Subtareas</Label>
        <SubtaskList parentTaskId={task.id} systemId={systemId} />
      </div>

      <TaskRemindersSection task={task} />

      <TimeLoggedSection taskId={task.id} />

      <div className="mt-auto flex items-center justify-between gap-3">
        {!isDone && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => !anotherRunning && openModeDialog({ id: task.id, title: task.title, systemId })}
            disabled={anotherRunning}
            className={cn(
              "gap-1.5",
              isThisRunning && "border-amber-500/50 text-amber-400",
            )}
          >
            <Timer size={14} className={cn(isThisRunning && "animate-pulse")} />
            {isThisRunning ? "En foco" : "Iniciar foco"}
          </Button>
        )}
        {saveStatus === "saved" && (
          <span className="text-sm text-muted-foreground">Guardado</span>
        )}
        <Button
          onClick={handleSave}
          disabled={!title.trim() || isPending}
          className="ml-auto"
        >
          {isPending ? "Guardando..." : "Guardar y cerrar"}
        </Button>
      </div>
    </div>
  );
}

export function TaskDetailSheet({ task, systemId, open, onOpenChange }: TaskDetailSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto flex flex-col">
        <SheetHeader className="px-6 pt-6 pb-0">
          <SheetTitle>Editar tarea</SheetTitle>
        </SheetHeader>
        {task && (
          <div className="flex-1 px-6 pb-6 pt-4">
            <TaskDetailForm
              key={task.id}
              task={task}
              systemId={systemId}
              onClose={() => onOpenChange(false)}
            />
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
