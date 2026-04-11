'use client';

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { taskPriorityEnum, taskStatusEnum, energyLevelEnum } from "@/shared/db/schema";
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
  energyPoints: 3 as number,
  scheduledDate: undefined as string | undefined,
  estimatedMinutes: undefined as number | undefined,
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
  const [energyPoints, setEnergyPoints] = useState(DEFAULT_STATE.energyPoints);
  const [scheduledDate, setScheduledDate] = useState(DEFAULT_STATE.scheduledDate);
  const [estimatedMinutes, setEstimatedMinutes] = useState(DEFAULT_STATE.estimatedMinutes);

  const { mutate: createTask, isPending } = useCreateTask(systemId);

  function resetForm() {
    setTitle(DEFAULT_STATE.title);
    setDescription(DEFAULT_STATE.description);
    setPriority(DEFAULT_STATE.priority);
    setStatus(DEFAULT_STATE.status);
    setDueDate(DEFAULT_STATE.dueDate);
    setEnergyLevel(DEFAULT_STATE.energyLevel);
    setEnergyPoints(DEFAULT_STATE.energyPoints);
    setScheduledDate(DEFAULT_STATE.scheduledDate);
    setEstimatedMinutes(DEFAULT_STATE.estimatedMinutes);
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
      ...(energyPoints !== 3 ? { energyPoints } : {}),
      ...(dueDate ? { dueDate } : {}),
      ...(scheduledDate ? { scheduledDate } : {}),
      ...(estimatedMinutes ? { estimatedMinutes } : {}),
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
        <Button variant="outline" className="w-full">+ Nueva tarea</Button>
      </DialogTrigger>

      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nueva tarea</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 pt-1">
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          {/* ── campos esenciales ── */}
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

          {/* ── campos avanzados ── */}
          {showMore && (
            <div className="flex flex-col gap-4">
              <div className="space-y-2">
                <Label htmlFor="description">Descripción</Label>
                <textarea
                  id="description"
                  className="flex min-h-[72px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
                  placeholder="Detalles opcionales..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
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

              <div className="space-y-3">
                <Label>Puntos de energía: <span className="font-semibold">{energyPoints}</span></Label>
                <Slider
                  min={1}
                  max={10}
                  step={1}
                  value={[energyPoints]}
                  onValueChange={([v]) => setEnergyPoints(v ?? 3)}
                />
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
                <Label htmlFor="estimatedMinutes">Tiempo estimado (minutos)</Label>
                <Input
                  id="estimatedMinutes"
                  type="number"
                  min={1}
                  placeholder="Ej: 30"
                  value={estimatedMinutes ?? ""}
                  onChange={(e) => setEstimatedMinutes(e.target.value ? Number(e.target.value) : undefined)}
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
