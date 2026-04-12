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
import { taskPriorityEnum, taskStatusEnum, energyLevelEnum, taskTypeEnum } from "@/shared/db/schema";
import { CalendarRange, ChevronDown, ChevronUp, Plus, X } from "lucide-react";
import type { CreateTaskInput } from "./tasks.types";
import { useCreateTask } from "./tasks.hooks";

interface CreateTaskDialogProps {
  systemId: string;
  parentTaskId?: string;
}

const DEFAULT_STATE = {
  title: "",
  description: "",
  priority: "medium" as CreateTaskInput["priority"],
  status: "backlog" as CreateTaskInput["status"],
  energyLevel: "medium" as CreateTaskInput["energyLevel"],
  taskType: undefined as CreateTaskInput["taskType"],
  estimatedTime: undefined as string | undefined,
  dateRange: { from: undefined, to: undefined } as DateRange,
};

export function CreateTaskDialog({ systemId, parentTaskId }: CreateTaskDialogProps) {
  const [open, setOpen] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState(DEFAULT_STATE.title);
  const [description, setDescription] = useState(DEFAULT_STATE.description);
  const [priority, setPriority] = useState(DEFAULT_STATE.priority);
  const [status, setStatus] = useState(DEFAULT_STATE.status);
  const [energyLevel, setEnergyLevel] = useState(DEFAULT_STATE.energyLevel);
  const [taskType, setTaskType] = useState(DEFAULT_STATE.taskType);
  const [estimatedTime, setEstimatedTime] = useState(DEFAULT_STATE.estimatedTime);
  const [dateRange, setDateRange] = useState<DateRange>({ from: new Date(), to: undefined });

  const [subtasks, setSubtasks] = useState<Array<{ id: string; title: string }>>([]);

  const { mutateAsync: createTask, isPending } = useCreateTask(systemId);

  function resetForm() {
    setTitle(DEFAULT_STATE.title);
    setDescription(DEFAULT_STATE.description);
    setPriority(DEFAULT_STATE.priority);
    setStatus(DEFAULT_STATE.status);
    setEnergyLevel(DEFAULT_STATE.energyLevel);
    setTaskType(DEFAULT_STATE.taskType);
    setEstimatedTime(DEFAULT_STATE.estimatedTime);
    setDateRange({ from: new Date(), to: undefined });
    setSubtasks([]);
    setShowMore(false);
    setError(null);
  }

  async function handleSubmit() {
    if (!title.trim() || !dateRange.from) return;

    const startDate = dateRange.from.toISOString().split("T")[0];
    const dueDate = dateRange.to?.toISOString().split("T")[0];

    const data: CreateTaskInput = {
      systemId,
      title: title.trim(),
      status,
      priority,
      startDate,
      ...(description ? { description } : {}),
      ...(energyLevel !== "medium" ? { energyLevel } : {}),
      ...(taskType ? { taskType } : {}),
      ...(dueDate ? { dueDate } : {}),
      ...(estimatedTime ? { estimatedTime } : {}),
      ...(parentTaskId ? { parentTaskId } : {}),
    };

    try {
      const parent = await createTask(data);
      const validSubtasks = subtasks.filter((s) => s.title.trim());
      for (const s of validSubtasks) {
        await createTask({
          systemId,
          title: s.title.trim(),
          status: "backlog",
          priority: "medium",
          startDate,
          parentTaskId: parent.id,
        });
      }
      resetForm();
      setOpen(false);
    } catch {
      // errors handled by TanStack Query
    }
  }

  return (
    <Dialog open={open} onOpenChange={(val) => { setOpen(val); if (!val) resetForm(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-fit">New task</Button>
      </DialogTrigger>

      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New task</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 pt-1">
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          {/* ── essential fields ── */}
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              autoFocus
              placeholder="What needs to be done?"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
              maxLength={500}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={(val) => setStatus(val as CreateTaskInput["status"])}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {taskStatusEnum.enumValues.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={(val) => setPriority(val as CreateTaskInput["priority"])}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {taskPriorityEnum.enumValues.map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Energy</Label>
              <Select value={energyLevel} onValueChange={(val) => setEnergyLevel(val as CreateTaskInput["energyLevel"])}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {energyLevelEnum.enumValues.map((e) => (
                    <SelectItem key={e} value={e}>{e}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* ── Date range ── */}
          <div className="space-y-2">
            <Label>
              Start date *
              {dateRange.from && dateRange.to && (
                <span className="ml-2 font-normal text-muted-foreground text-xs">
                  {Math.round((dateRange.to.getTime() - dateRange.from.getTime()) / 86400000)} day{Math.round((dateRange.to.getTime() - dateRange.from.getTime()) / 86400000) !== 1 ? "s" : ""}
                </span>
              )}
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start gap-2 text-sm font-normal"
                >
                  <CalendarRange size={14} className="shrink-0 text-muted-foreground" />
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
                  onSelect={(range) => setDateRange(range ?? DEFAULT_STATE.dateRange)}
                  numberOfMonths={1}
                />
                {(dateRange.from || dateRange.to) && (
                  <div className="p-2 border-t">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full"
                      onClick={() => setDateRange(DEFAULT_STATE.dateRange)}
                    >
                      Clear dates
                    </Button>
                  </div>
                )}
              </PopoverContent>
            </Popover>
          </div>

          {/* ── Toggle ── */}
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
                <><ChevronUp size={14} className="mr-1" />Less options</>
              ) : (
                <><ChevronDown size={14} className="mr-1" />More options</>
              )}
            </Button>
          </div>

          {/* ── advanced fields ── */}
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

              <div className="space-y-2">
                <Label>Task type</Label>
                <Select value={taskType ?? ""} onValueChange={(val) => setTaskType(val as CreateTaskInput["taskType"])}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type..." />
                  </SelectTrigger>
                  <SelectContent>
                    {taskTypeEnum.enumValues.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

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
                className="h-7 text-xs text-muted-foreground"
                onClick={() =>
                  setSubtasks((prev) => [...prev, { id: crypto.randomUUID(), title: "" }])
                }
              >
                <Plus size={12} className="mr-1" />
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
                  <X size={13} />
                </Button>
              </div>
            ))}
          </div>

          {/* ── Submit ── */}
          <Button
            onClick={handleSubmit}
            disabled={!title.trim() || isPending}
            className="w-full"
          >
            {isPending ? "Creating..." : "Create task"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
