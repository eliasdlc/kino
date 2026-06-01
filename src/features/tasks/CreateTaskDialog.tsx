'use client';

import { useState } from "react";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { ENERGY_LEVEL_VALUES, TASK_PRIORITY_VALUES } from "@/shared/types/enums";
import { Bell, CalendarIcon, CalendarRange, ChevronDown, ChevronUp, Plus, X } from "lucide-react";
import type { CreateTaskInput, Task } from "./tasks.types";
import { useCreateTask } from "./tasks.hooks";
import { useFolders } from "@/features/folders/folders.hooks";
import { getSystemColor } from "@/shared/utils/system-colors";
import { TaskTypePicker } from "./TaskTypePicker";
import { getTaskTypeConfig } from "./task-type-config";

interface CreateTaskDialogProps {
  systemId: string;
  parentTaskId?: string;
  /** When set, new tasks are auto-assigned to this folder */
  folderId?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Optional slot rendered at the top of the dialog (e.g. a system selector) */
  header?: React.ReactNode;
  /** Called after the task is successfully created — useful for auto-linking */
  onTaskCreated?: (task: Task) => void;
}

export function CreateTaskDialog({ systemId, parentTaskId, folderId, open: controlledOpen, onOpenChange: controlledOnOpenChange, header, onTaskCreated }: CreateTaskDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;

  const setOpen = (newOpen: boolean) => {
    if (isControlled && controlledOnOpenChange) {
      controlledOnOpenChange(newOpen);
    } else {
      setInternalOpen(newOpen);
    }
  };

  const [showMore, setShowMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<CreateTaskInput["priority"]>("medium");
  const [energyLevel, setEnergyLevel] = useState<CreateTaskInput["energyLevel"]>("medium");
  const [taskType, setTaskType] = useState<CreateTaskInput["taskType"]>(undefined);
  const [estimatedTime, setEstimatedTime] = useState<string | undefined>(undefined);
  const [dateRange, setDateRange] = useState<DateRange>({ from: new Date(), to: undefined });
  // Reminder-specific: single due date
  const [reminderDueDate, setReminderDueDate] = useState<Date | undefined>(undefined);

  const [subtasks, setSubtasks] = useState<Array<{ id: string; title: string }>>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string>(folderId ?? "none");

  // Reset folder when the target system changes (derived state pattern — runs during render, not in an effect)
  const [prevSystemId, setPrevSystemId] = useState(systemId);
  if (prevSystemId !== systemId) {
    setPrevSystemId(systemId);
    setSelectedFolderId("none");
  }

  const typeConfig = getTaskTypeConfig(taskType);
  const { data: folders = [] } = useFolders(systemId);
  const { mutateAsync: createTask, isPending } = useCreateTask(systemId, selectedFolderId !== "none" ? selectedFolderId : undefined);

  const durationDays =
    dateRange.from && dateRange.to
      ? Math.round((dateRange.to.getTime() - dateRange.from.getTime()) / 86400000)
      : null;

  function resetForm() {
    setTitle("");
    setDescription("");
    setPriority("medium");
    setEnergyLevel("medium");
    setTaskType(undefined);
    setEstimatedTime(undefined);
    setDateRange({ from: new Date(), to: undefined });
    setReminderDueDate(undefined);
    setSubtasks([]);
    setSelectedFolderId(folderId ?? "none");
    setShowMore(false);
    setError(null);
  }

  const isSubmitDisabled =
    !title.trim() ||
    isPending ||
    (typeConfig.requireDueDate && !reminderDueDate);

  async function handleSubmit() {
    if (isSubmitDisabled) return;

    const startDate = typeConfig.hideDatePicker ? undefined : (dateRange.from ? format(dateRange.from, "yyyy-MM-dd") : undefined);
    const dueDate = typeConfig.requireDueDate
      ? (reminderDueDate ? format(reminderDueDate, "yyyy-MM-dd") : undefined)
      : (dateRange.to ? format(dateRange.to, "yyyy-MM-dd") : undefined);

    const data: CreateTaskInput = {
      systemId,
      title: title.trim(),
      priority,
      energyLevel,
      ...(startDate ? { startDate } : {}),
      ...(description ? { description } : {}),
      ...(taskType ? { taskType } : {}),
      ...(dueDate ? { dueDate } : {}),
      ...(estimatedTime ? { estimatedTime } : {}),
      ...(parentTaskId ? { parentTaskId } : {}),
      ...(selectedFolderId !== "none" ? { folderId: selectedFolderId } : {}),
    };

    try {
      const parent = await createTask(data);
      const validSubtasks = subtasks.filter((s) => s.title.trim());
      await Promise.all(
        validSubtasks.map((s) =>
          createTask({
            systemId,
            title: s.title.trim(),
            status: "backlog",
            priority: "medium",
            energyLevel: "medium",
            ...(startDate ? { startDate } : {}),
            parentTaskId: parent.id,
          }),
        ),
      );
      resetForm();
      onTaskCreated?.(parent);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create task");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(val) => { setOpen(val); if (!val) resetForm(); }}>
      {!isControlled && (
        <DialogTrigger asChild>
          <Button variant="outline" className="w-fit">New task</Button>
        </DialogTrigger>
      )}

      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New task</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 pt-1">
          {/* ── Injected header slot (e.g. system selector from GlobalQuickAddDialog) ── */}
          {header}

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          {/* ── Type picker (first, sets context for everything else) ── */}
          <div className="space-y-2">
            <Label>Type</Label>
            <TaskTypePicker value={taskType} onChange={setTaskType} />
          </div>

          {/* ── Title ── */}
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              autoFocus
              placeholder={
                taskType === "idea" ? "Describe your idea..." :
                taskType === "reminder" ? "What do you need to remember?" :
                taskType === "project" ? "Project name..." :
                "What needs to be done?"
              }
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
              maxLength={500}
            />
          </div>

          {/* ── Priority + Energy (energy hidden for idea/reminder) ── */}
          <div className={typeConfig.hideEnergyLevel ? "" : "grid grid-cols-2 gap-3"}>
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={(val) => setPriority(val as CreateTaskInput["priority"])}>
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

            {!typeConfig.hideEnergyLevel && (
              <div className="space-y-2">
                <Label>Energy</Label>
                <Select value={energyLevel} onValueChange={(val) => setEnergyLevel(val as CreateTaskInput["energyLevel"])}>
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
            )}
          </div>

          {/* ── Folder assignment ── */}
          {folders.length > 0 && (
            <div className="space-y-2">
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

          {/* ── Reminder: single due date (required) ── */}
          {typeConfig.requireDueDate && (
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <Bell size={16} className="text-orange-500" />
                Due date *
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start gap-2 text-sm font-normal"
                  >
                    <CalendarIcon size={16} className="shrink-0 text-muted-foreground" />
                    {reminderDueDate
                      ? format(reminderDueDate, "MMM d, yyyy")
                      : <span className="text-muted-foreground">Select deadline</span>
                    }
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={reminderDueDate}
                    onSelect={setReminderDueDate}
                  />
                  {reminderDueDate && (
                    <div className="p-2 border-t">
                      <Button variant="ghost" size="sm" className="w-full" onClick={() => setReminderDueDate(undefined)}>
                        Clear
                      </Button>
                    </div>
                  )}
                </PopoverContent>
              </Popover>
            </div>
          )}

          {/* ── Date range (todo / project — not idea, not reminder) ── */}
          {!typeConfig.hideDatePicker && !typeConfig.requireDueDate && (
            <div className="space-y-2">
              <Label>
                Start date
                {!dateRange.from && (
                  <span className="ml-2 font-normal text-muted-foreground text-xs">
                    (none → backlog)
                  </span>
                )}
                {durationDays !== null && (
                  <span className="ml-2 font-normal text-muted-foreground text-xs">
                    {durationDays} day{durationDays !== 1 ? "s" : ""}
                  </span>
                )}
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start gap-2 text-sm font-normal"
                  >
                    <CalendarRange size={16} className="shrink-0 text-muted-foreground" />
                    {dateRange.from ? (
                      dateRange.to ? (
                        <span>{format(dateRange.from, "MMM d")} → {format(dateRange.to, "MMM d, yyyy")}</span>
                      ) : (
                        <span>{format(dateRange.from, "MMM d, yyyy")} <span className="text-muted-foreground">→ no end date</span></span>
                      )
                    ) : (
                      <span className="text-muted-foreground">Select start date</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="range"
                    selected={dateRange}
                    onSelect={(range) => setDateRange(range ?? { from: new Date(), to: undefined })}
                    numberOfMonths={1}
                  />
                  {(dateRange.from || dateRange.to) && (
                    <div className="p-2 border-t">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full"
                        onClick={() => setDateRange({ from: undefined, to: undefined })}
                      >
                        Clear dates
                      </Button>
                    </div>
                  )}
                </PopoverContent>
              </Popover>
            </div>
          )}

          {/* ── More options toggle ── */}
          <div>
            <Separator />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full mt-2 text-muted-foreground"
              onClick={() => setShowMore((v) => !v)}
            >
              {showMore ? (
                <><ChevronUp size={16} className="mr-1" />Less options</>
              ) : (
                <><ChevronDown size={16} className="mr-1" />More options</>
              )}
            </Button>
          </div>

          {/* ── Advanced fields ── */}
          {showMore && (
            <div className="flex flex-col gap-4">
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Optional details..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="min-h-[72px] resize-none"
                />
              </div>

              {!typeConfig.hideEnergyLevel && (
                <div className="space-y-2">
                  <Label htmlFor="estimatedTime">Estimated time (HH:MM:SS)</Label>
                  <Input
                    id="estimatedTime"
                    type="time"
                    placeholder="00:00:00"
                    value={estimatedTime ?? ""}
                    onChange={(e) => setEstimatedTime(e.target.value || undefined)}
                  />
                </div>
              )}
            </div>
          )}

          {/* ── Subtasks ── */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Subtasks</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 text-sm text-muted-foreground"
                onClick={() =>
                  setSubtasks((prev) => [...prev, { id: crypto.randomUUID(), title: "" }])
                }
              >
                <Plus size={14} className="mr-1" />
                Add subtask
              </Button>
            </div>

            {subtasks.map((subtask, index) => (
              <div key={subtask.id} className="flex items-center gap-2">
                <Input
                  placeholder={`Subtask ${index + 1}`}
                  value={subtask.title}
                  onChange={(e) => {
                    const updated = [...subtasks];
                    updated[index] = { ...updated[index], title: e.target.value };
                    setSubtasks(updated);
                  }}
                  maxLength={500}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="shrink-0 size-8"
                  onClick={() => setSubtasks((prev) => prev.filter((_, i) => i !== index))}
                  aria-label="Delete subtask"
                >
                  <X size={16} />
                </Button>
              </div>
            ))}
          </div>

          {/* ── Submit ── */}
          <Button
            onClick={handleSubmit}
            disabled={isSubmitDisabled}
            className="w-full"
          >
            {isPending ? "Creating..." : "Create task"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
