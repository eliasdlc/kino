"use client";

import { useState } from "react";
import { format, parseISO } from "date-fns";
import { CalendarIcon } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
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

  function handleSave() {
    if (!title.trim()) return;
    // Status is intentionally excluded — it should only change via
    // toggle/move endpoints that enforce the state machine and XP rules.
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
                    <span className={`size-2 rounded-full inline-block ${getSystemColor(folder.color).dot}`} />
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
                <CalendarIcon size={14} className="text-muted-foreground" />
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
                <CalendarIcon size={14} className="text-muted-foreground" />
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

      <Button onClick={handleSave} disabled={!title.trim() || isPending} className="mt-auto">
        {isPending ? "Saving..." : "Save changes"}
      </Button>
    </div>
  );
}

export function TaskDetailSheet({ task, systemId, open, onOpenChange }: TaskDetailSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto flex flex-col gap-6">
        <SheetHeader>
          <SheetTitle>Edit task</SheetTitle>
        </SheetHeader>
        {task && (
          <TaskDetailForm
            key={task.id}
            task={task}
            systemId={systemId}
            onClose={() => onOpenChange(false)}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}
