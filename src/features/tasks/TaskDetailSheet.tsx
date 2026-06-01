"use client";

import { useEffect, useRef, useState } from "react";
import { format, parseISO } from "date-fns";
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
import { useUpdateTask } from "./tasks.hooks";
import { useFolders } from "@/features/folders/folders.hooks";
import { getSystemColor } from "@/shared/utils/system-colors";
import { TaskTypePicker } from "./TaskTypePicker";
import type { Task } from "./tasks.types";
import { useTimerStore } from "./timer.store";

interface TaskDetailSheetProps {
  task: Task | null;
  systemId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface TaskDetailFormProps {
  task: Task;
  systemId: string;
  onClose: () => void;
}

function TaskDetailForm({ task, systemId, onClose }: TaskDetailFormProps) {
  const { mutate: updateTask, isPending } = useUpdateTask(systemId);
  const { data: folders = [] } = useFolders(systemId);

  const startTimer = useTimerStore((s) => s.startTimer);
  const activeTimer = useTimerStore((s) => s.active);
  const isThisRunning = activeTimer?.taskId === task.id;
  const anotherRunning = activeTimer !== null && !isThisRunning;
  const isDone = task.status === "done" || task.status === "archived";

  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");
  const [priority, setPriority] = useState<Task["priority"]>(task.priority);
  const [energyLevel, setEnergyLevel] = useState<Task["energyLevel"]>(task.energyLevel);
  const [taskType, setTaskType] = useState<TaskTypeValue | undefined>(task.taskType ?? undefined);
  const [dueDate, setDueDate] = useState<Date | undefined>(
    task.dueDate ? parseISO(task.dueDate) : undefined
  );
  const [startDate, setStartDate] = useState<Date | undefined>(
    task.startDate ? parseISO(task.startDate) : undefined
  );
  const [selectedFolderId, setSelectedFolderId] = useState<string>(task.folderId ?? "none");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved">("idle");

  const isMountedRef = useRef(false);
  const updateTaskRef = useRef(updateTask);
  updateTaskRef.current = updateTask;

  useEffect(() => {
    if (!isMountedRef.current) {
      isMountedRef.current = true;
      return;
    }
    if (!title.trim()) return;

    setSaveStatus("idle");
    const timer = setTimeout(() => {
      updateTaskRef.current(
        {
          taskId: task.id,
          data: {
            title: title.trim(),
            description: description || undefined,
            priority,
            energyLevel,
            taskType: taskType ?? null,
            dueDate: dueDate ? format(dueDate, "yyyy-MM-dd") : undefined,
            startDate: startDate ? format(startDate, "yyyy-MM-dd") : undefined,
            folderId: selectedFolderId !== "none" ? selectedFolderId : null,
          },
        },
        { onSuccess: () => setSaveStatus("saved") }
      );
    }, 1500);

    return () => clearTimeout(timer);
  // task.id is stable for the lifetime of this form instance (key={task.id} in parent)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, description, priority, energyLevel, taskType, dueDate, startDate, selectedFolderId]);

  function handleSave() {
    if (!title.trim()) return;
    updateTask(
      {
        taskId: task.id,
        data: {
          title: title.trim(),
          description: description || undefined,
          priority,
          energyLevel,
          taskType: taskType ?? null,
          dueDate: dueDate ? format(dueDate, "yyyy-MM-dd") : undefined,
          startDate: startDate ? format(startDate, "yyyy-MM-dd") : undefined,
          folderId: selectedFolderId !== "none" ? selectedFolderId : null,
        },
      },
      { onSuccess: onClose }
    );
  }

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="space-y-1.5">
        <Label htmlFor="task-title">Title</Label>
        <Input
          id="task-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={500}
          autoFocus
        />
      </div>

      <div className="space-y-1.5">
        <Label>Type</Label>
        <TaskTypePicker value={taskType} onChange={setTaskType} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="task-desc">Description</Label>
        <Textarea
          id="task-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional notes..."
          className="resize-none min-h-[80px]"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Priority</Label>
          <Select value={priority} onValueChange={(v) => setPriority(v as Task["priority"])}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TASK_PRIORITY_VALUES.map((p) => (
                <SelectItem key={p} value={p}>{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Energy</Label>
          <Select value={energyLevel} onValueChange={(v) => setEnergyLevel(v as Task["energyLevel"])}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ENERGY_LEVEL_VALUES.map((e) => (
                <SelectItem key={e} value={e}>{e}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {folders.length > 0 && (
        <div className="space-y-1.5">
          <Label>Assign to</Label>
          <Select value={selectedFolderId} onValueChange={setSelectedFolderId}>
            <SelectTrigger>
              <SelectValue placeholder="No folder" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">
                <span className="text-muted-foreground">No folder</span>
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
          <Label>Start date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-start gap-2 text-sm font-normal">
                <CalendarIcon size={16} className="text-muted-foreground" />
                {startDate ? format(startDate, "MMM d, yyyy") : <span className="text-muted-foreground">Pick date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={startDate} onSelect={setStartDate} />
              {startDate && (
                <div className="p-2 border-t">
                  <Button variant="ghost" size="sm" className="w-full" onClick={() => setStartDate(undefined)}>
                    Clear
                  </Button>
                </div>
              )}
            </PopoverContent>
          </Popover>
        </div>

        <div className="space-y-1.5">
          <Label>Due date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-start gap-2 text-sm font-normal">
                <CalendarIcon size={16} className="text-muted-foreground" />
                {dueDate ? format(dueDate, "MMM d, yyyy") : <span className="text-muted-foreground">Pick date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={dueDate} onSelect={setDueDate} />
              {dueDate && (
                <div className="p-2 border-t">
                  <Button variant="ghost" size="sm" className="w-full" onClick={() => setDueDate(undefined)}>
                    Clear
                  </Button>
                </div>
              )}
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <Separator />

      <div className="space-y-2">
        <Label>Subtasks</Label>
        <SubtaskList parentTaskId={task.id} systemId={systemId} />
      </div>

      <div className="mt-auto flex items-center justify-between gap-3">
        {!isDone && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => !anotherRunning && startTimer(task.id, systemId, task.title)}
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
          <span className="text-sm text-muted-foreground">Saved</span>
        )}
        <Button
          onClick={handleSave}
          disabled={!title.trim() || isPending}
          className="ml-auto"
        >
          {isPending ? "Saving..." : "Save & close"}
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
          <SheetTitle>Edit task</SheetTitle>
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
