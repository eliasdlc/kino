"use client";

import { useEffect, useRef, useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { parseDueDate } from "./tasks.utils";
import { Timer } from "lucide-react";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
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
import { Separator } from "@/components/ui/separator";
import {
  ENERGY_LEVEL_VALUES,
  TASK_PRIORITY_VALUES,
} from "@/shared/types/enums";
import type { TaskTypeValue } from "@/shared/types/enums";
import { SubtaskList } from "./SubtaskList";
import { TaskRemindersSection } from "./TaskRemindersSection";
import { useUpdateTask } from "./tasks.hooks";
import { RecurrencePicker } from "./RecurrencePicker";
import { useFolders } from "@/features/folders/folders.hooks";
import { useSprints } from "@/features/sprints/sprints.hooks";
import { getSystemColor } from "@/shared/utils/system-colors";
import { TaskTypePicker } from "./TaskTypePicker";
import { TagPicker } from "@/features/tags/TagPicker";
import type { TaskTransport } from "./tasks.types";
import { useFocusTimer } from "./FocusTimerProvider";
import { useQueryClient } from "@tanstack/react-query";
import type { SystemType } from "@/shared/lib/system-types";
import type { System } from "@/features/systems/systems.types";
import {
  ENERGY_LABELS,
  PRIORITY_LABELS,
  buildDirtyTaskData,
  needsGradeField,
} from "./task-detail.helpers";
import {
  DateTimeField,
  ExportTaskJsonButton,
  GradeField,
  TimeLoggedSection,
} from "./TaskDetailFields";

interface TaskDetailSheetProps {
  task: TaskTransport | null;
  systemId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface TaskDetailFormProps {
  task: TaskTransport;
  systemId: string;
  onClose: () => void;
}

function TaskDetailForm({ task, systemId, onClose }: TaskDetailFormProps) {
  const isMobile = useIsMobile();
  const { mutate: updateTask, isPending } = useUpdateTask(systemId);
  const { data: folders = [] } = useFolders(systemId);
  const { data: sprints = [] } = useSprints(systemId);
  const activeSprints = sprints.filter((s) => s.status === "active");

  const { state: timerState, openModeDialog } = useFocusTimer();
  const isThisRunning = timerState.taskId === task.id && timerState.phase !== 'idle';
  const anotherRunning = timerState.phase !== 'idle' && !isThisRunning;
  const isDone = task.status === "done" || task.status === "archived";

  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");
  const [priority, setPriority] = useState<TaskTransport["priority"]>(task.priority);
  const [energyLevel, setEnergyLevel] = useState<TaskTransport["energyLevel"]>(task.energyLevel);
  const [taskType, setTaskType] = useState<TaskTypeValue | undefined>(
    (task.taskType && ['task', 'idea', 'event', 'reminder', 'epic'].includes(task.taskType))
      ? (task.taskType as TaskTypeValue)
      : undefined
  );
  const [metadata, setMetadata] = useState<Record<string, unknown> | null>(task.metadata ?? null);
  const [dueDate, setDueDate] = useState<Date | undefined>(
    task.dueDate ? parseDueDate(task.dueDate) : undefined
  );
  const [startDate, setStartDate] = useState<Date | undefined>(
    task.startDate ? parseDueDate(task.startDate) : undefined
  );
  const [selectedFolderId, setSelectedFolderId] = useState<string>(task.folderId ?? "none");
  const [sprintId, setSprintId] = useState<string>(task.sprintId ?? "none");
  const [contextTagId, setContextTagId] = useState<string | null>(task.contextTagId ?? null);
  const [recurrenceRule, setRecurrenceRule] = useState<string | null>(task.recurrenceRule ?? null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved">("idle");

  const queryClient = useQueryClient();
  const cachedSystems = queryClient.getQueryData<System[]>(['systems']);
  const systemTemplateType = cachedSystems?.find((s) => s.id === systemId)?.templateType as SystemType | undefined;

  const isMountedRef = useRef(false);
  const updateTaskRef = useRef(updateTask);
  updateTaskRef.current = updateTask;

  function buildDirtyData() {
    return buildDirtyTaskData(task, {
      title,
      description,
      priority,
      energyLevel,
      taskType,
      dueDate,
      startDate,
      selectedFolderId,
      sprintId,
      contextTagId,
      recurrenceRule,
      metadata,
    });
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
  }, [title, description, priority, energyLevel, taskType, dueDate, startDate, selectedFolderId, sprintId, contextTagId, recurrenceRule, metadata]);

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
        <TaskTypePicker
          value={taskType}
          metadata={metadata}
          systemTemplateType={systemTemplateType}
          onChange={(val, subtype) => {
            setTaskType(val);
            const currentMetadata = metadata || {};
            if (subtype) {
              setMetadata({ ...currentMetadata, eventSubtype: subtype });
            } else {
              const newMetadata = { ...currentMetadata };
              delete newMetadata.eventSubtype;
              setMetadata(Object.keys(newMetadata).length ? newMetadata : null);
            }
          }}
        />
      </div>

      {/* Categoría (context_tag) — permite crear categorías inline. */}
      <TagPicker systemId={systemId} value={contextTagId} onChange={setContextTagId} label="Categoría" allowCreate />

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
          <Select value={priority} onValueChange={(v) => setPriority(v as TaskTransport["priority"])}>
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
          <Select value={energyLevel} onValueChange={(v) => setEnergyLevel(v as TaskTransport["energyLevel"])}>
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

      {activeSprints.length > 0 && (
        <div className="space-y-1.5">
          <Label>Sprint</Label>
          <Select value={sprintId} onValueChange={setSprintId}>
            <SelectTrigger>
              <SelectValue placeholder="Sin sprint" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">
                <span className="text-muted-foreground">Sin sprint</span>
              </SelectItem>
              {activeSprints.map((sprint) => (
                <SelectItem key={sprint.id} value={sprint.id}>
                  {sprint.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <DateTimeField
          label="Fecha de inicio"
          timeInputId="start-time"
          value={startDate}
          onChange={setStartDate}
        />
        <DateTimeField
          label="Fecha de vencimiento"
          timeInputId="due-time"
          value={dueDate}
          onChange={setDueDate}
        />
      </div>

      <Separator />

      <div className="space-y-2">
        <Label>Repetición</Label>
        <RecurrencePicker value={recurrenceRule} onChange={setRecurrenceRule} />
      </div>

      <Separator />

      {needsGradeField(isDone, taskType, metadata) && (
        <>
          <GradeField metadata={metadata} onChange={setMetadata} />
          <Separator />
        </>
      )}

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
        <div className="ml-auto flex items-center gap-2">
          <ExportTaskJsonButton task={task} />
          <Button
            onClick={handleSave}
            disabled={!title.trim() || isPending}
          >
            {isPending ? "Guardando..." : "Guardar y cerrar"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function TaskDetailSheet({ task, systemId, open, onOpenChange }: TaskDetailSheetProps) {
  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Editar tarea</ResponsiveDialogTitle>
        </ResponsiveDialogHeader>
        {task && (
          <TaskDetailForm
            key={task.id}
            task={task}
            systemId={systemId}
            onClose={() => onOpenChange(false)}
          />
        )}
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
