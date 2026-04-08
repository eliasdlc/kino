'use client';

import { useState } from "react";
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
import { ChevronDown, ChevronUp } from "lucide-react";
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
  dueDate: undefined as string | undefined,
  energyLevel: "medium" as CreateTaskInput["energyLevel"],
  taskType: undefined as CreateTaskInput["taskType"],
  scheduledDate: undefined as string | undefined,
  estimatedTime: undefined as string | undefined,
};

export function CreateTaskDialog({ systemId, parentTaskId }: CreateTaskDialogProps) {
  const [open, setOpen] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState(DEFAULT_STATE.title);
  const [description, setDescription] = useState(DEFAULT_STATE.description);
  const [priority, setPriority] = useState(DEFAULT_STATE.priority);
  const [status, setStatus] = useState(DEFAULT_STATE.status);
  const [dueDate, setDueDate] = useState(DEFAULT_STATE.dueDate);
  const [energyLevel, setEnergyLevel] = useState(DEFAULT_STATE.energyLevel);
  const [taskType, setTaskType] = useState(DEFAULT_STATE.taskType);
  const [scheduledDate, setScheduledDate] = useState(DEFAULT_STATE.scheduledDate);
  const [estimatedTime, setEstimatedTime] = useState(DEFAULT_STATE.estimatedTime);

  const { mutate: createTask, isPending } = useCreateTask(systemId);

  function resetForm() {
    setTitle(DEFAULT_STATE.title);
    setDescription(DEFAULT_STATE.description);
    setPriority(DEFAULT_STATE.priority);
    setStatus(DEFAULT_STATE.status);
    setDueDate(DEFAULT_STATE.dueDate);
    setEnergyLevel(DEFAULT_STATE.energyLevel);
    setTaskType(DEFAULT_STATE.taskType);
    setScheduledDate(DEFAULT_STATE.scheduledDate);
    setEstimatedTime(DEFAULT_STATE.estimatedTime);
    setShowMore(false);
    setError(null);
  }

  function handleSubmit() {
    if (!title.trim()) return;

    const data: CreateTaskInput = {
      systemId,
      title: title.trim(),
      status,
      priority,
      ...(description ? { description } : {}),
      ...(energyLevel !== "medium" ? { energyLevel } : {}),
      ...(taskType ? { taskType } : {}),
      ...(dueDate ? { dueDate } : {}),
      ...(scheduledDate ? { scheduledDate } : {}),
      ...(estimatedTime ? { estimatedTime } : {}),
      ...(parentTaskId ? { parentTaskId } : {}),
    };

    setError(null);
    createTask(data, {
      onSuccess: () => {
        resetForm();
        setOpen(false);
      },
      onError: (err) => {
        setError(err.message ?? "Error al crear la tarea");
      },
    });
  }

  return (
    <Dialog open={open} onOpenChange={(val) => { setOpen(val); if (!val) resetForm(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-fit">Nueva tarea</Button>
      </DialogTrigger>

      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nueva tarea</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 pt-1">
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          {/* ── essential fields ── */}
          <div className="space-y-2">
            <Label htmlFor="title">Título *</Label>
            <Input
              id="title"
              autoFocus
              placeholder="¿Qué hay que hacer?"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
              maxLength={500}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Estado</Label>
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
              <Label>Prioridad</Label>
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
                <><ChevronUp size={14} className="mr-1" />Menos opciones</>
              ) : (
                <><ChevronDown size={14} className="mr-1" />Más opciones</>
              )}
            </Button>
          </div>

          {/* ── advanced fields ── */}
          {showMore && (
            <div className="flex flex-col gap-4">
              <div className="space-y-2">
                <Label htmlFor="description">Descripción</Label>
                <Textarea
                  id="description"
                  placeholder="Detalles opcionales..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="min-h-[72px] resize-none"
                />
              </div>

              <div className="space-y-2">
                <Label>Nivel de energía</Label>
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

              <div className="space-y-2">
                <Label>Tipo de tarea</Label>
                <Select value={taskType ?? ""} onValueChange={(val) => setTaskType(val as CreateTaskInput["taskType"])}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar tipo..." />
                  </SelectTrigger>
                  <SelectContent>
                    {taskTypeEnum.enumValues.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Fecha límite</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-sm font-normal">
                        {dueDate ?? "Sin fecha"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={dueDate ? new Date(dueDate) : undefined}
                        onSelect={(val) => setDueDate(val?.toISOString().split("T")[0])}
                      />
                      {dueDate && (
                        <div className="p-2 border-t">
                          <Button variant="ghost" size="sm" className="w-full" onClick={() => setDueDate(undefined)}>
                            Quitar fecha
                          </Button>
                        </div>
                      )}
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label>Fecha programada</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-sm font-normal">
                        {scheduledDate ?? "Sin fecha"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={scheduledDate ? new Date(scheduledDate) : undefined}
                        onSelect={(val) => setScheduledDate(val?.toISOString().split("T")[0])}
                      />
                      {scheduledDate && (
                        <div className="p-2 border-t">
                          <Button variant="ghost" size="sm" className="w-full" onClick={() => setScheduledDate(undefined)}>
                            Quitar fecha
                          </Button>
                        </div>
                      )}
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="estimatedTime">Tiempo estimado (HH:MM:SS)</Label>
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

          {/* ── Submit ── */}
          <Button
            onClick={handleSubmit}
            disabled={!title.trim() || isPending}
            className="w-full"
          >
            {isPending ? "Creando..." : "Crear tarea"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
