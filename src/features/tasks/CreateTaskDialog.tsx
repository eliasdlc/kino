'use client';

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { ENERGY_LEVEL_VALUES, TASK_PRIORITY_VALUES } from "@/shared/types/enums";
import { CalendarRange, ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CreateTaskInput, Task } from "./tasks.types";
import { useCreateTask } from "./tasks.hooks";
import { useFolders } from "@/features/folders/folders.hooks";
import { getSystemColor } from "@/shared/utils/system-colors";
import { TaskTypePicker } from "./TaskTypePicker";
import { getTaskTypeConfig } from "./task-type-config";
import { dayToLocalISO } from "./tasks.utils";
import { parseQuickDate } from "./quick-date-parse";
import { EstimatedTimePicker, minutesToTimeString } from "./EstimatedTimePicker";
import { useQueryClient } from "@tanstack/react-query";
import { SYSTEM_TYPE_CONFIG, type SystemType } from "@/shared/lib/system-types";
import type { System } from "@/features/systems/systems.types";

const formSchema = z.object({
  title: z.string().min(1, "El título es requerido").max(500),
  taskType: z.enum(['task', 'idea', 'event', 'reminder']).nullable().optional(),
  priority: z.enum(['critical', 'high', 'medium', 'low']),
  energyLevel: z.enum(['high', 'medium', 'low']),
  startDate: z.string().date().nullable().optional(),
  dueDate: z.string().date().nullable().optional(),
  startTime: z.string().optional(),
  dueTime: z.string().optional(),
  estimatedMinutes: z.number().int().min(1).nullable().optional(),
  description: z.string().optional(),
  folderId: z.string().uuid().nullable().optional(),
});

type FormValues = z.infer<typeof formSchema>;

const STEP_FIELDS: Record<1 | 2 | 3, (keyof FormValues)[]> = {
  1: ['title'],
  2: ['priority', 'energyLevel'],
  3: [],
};

interface CreateTaskDialogProps {
  systemId: string;
  parentTaskId?: string;
  folderId?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  header?: React.ReactNode;
  onTaskCreated?: (task: Task) => void;
}

export function CreateTaskDialog({
  systemId, parentTaskId, folderId, open: controlledOpen,
  onOpenChange: controlledOnOpenChange, header, onTaskCreated,
}: CreateTaskDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;

  const setOpen = (val: boolean) => {
    if (isControlled && controlledOnOpenChange) controlledOnOpenChange(val);
    else setInternalOpen(val);
  };

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [subtasks, setSubtasks] = useState<Array<{ id: string; title: string }>>([]);
  const [dateRange, setDateRange] = useState<DateRange>({ from: undefined, to: undefined });
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { data: folders = [] } = useFolders(systemId);
  const { mutateAsync: createTask, isPending } = useCreateTask(systemId);
  const queryClient = useQueryClient();

  // Derive energy default from system type (zero-cost: reads from cache)
  const cachedSystems = queryClient.getQueryData<System[]>(['systems']);
  const systemTemplateType = cachedSystems?.find((s) => s.id === systemId)?.templateType as SystemType | undefined;
  const rawEnergyDefault = systemTemplateType ? SYSTEM_TYPE_CONFIG[systemTemplateType]?.energyDefault : null;
  const energyDefault: 'high' | 'medium' | 'low' =
    rawEnergyDefault === 'high' ? 'high' : rawEnergyDefault === 'low' ? 'low' : 'medium';

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: '',
      taskType: null,
      priority: 'medium',
      energyLevel: energyDefault,
      startDate: null,
      dueDate: null,
      startTime: '',
      dueTime: '',
      estimatedMinutes: null,
      description: '',
      folderId: folderId ?? null,
    },
  });

  const taskType = form.watch('taskType');
  const typeConfig = getTaskTypeConfig(taskType);

  // Fechas en lenguaje natural escritas en el título ("pagar luz mañana a las 5").
  const [nlIgnored, setNlIgnored] = useState(false);
  const nlParsed = nlIgnored ? null : parseQuickDate(form.watch('title'));

  function applyNlParse() {
    if (!nlParsed) return;
    if (form.getValues('startDate') || form.getValues('dueDate')) return;
    if (nlParsed.title) form.setValue('title', nlParsed.title);
    const day = new Date(nlParsed.dueDate + 'T00:00:00');
    form.setValue('startDate', nlParsed.dueDate);
    form.setValue('dueDate', nlParsed.dueDate);
    if (nlParsed.dueTime) form.setValue('dueTime', nlParsed.dueTime);
    setDateRange({ from: day, to: day });
  }

  async function nextStep() {
    if (step === 1) applyNlParse();
    const ok = await form.trigger(STEP_FIELDS[step]);
    if (ok && step < 3) setStep((s) => (s + 1) as 1 | 2 | 3);
  }

  function prevStep() {
    if (step > 1) setStep((s) => (s - 1) as 1 | 2 | 3);
  }

  async function onSubmit(values: FormValues) {
    if (step === 1 && nlParsed && !values.startDate && !values.dueDate) {
      applyNlParse();
      values = form.getValues();
    }
    if (values.taskType === 'event' && !values.startDate) {
      form.setError('startDate', { message: 'Los eventos requieren fecha de inicio' });
      setStep(2);
      return;
    }
    if (values.taskType === 'reminder' && !values.dueDate) {
      form.setError('dueDate', { message: 'Los recordatorios requieren fecha límite' });
      setStep(2);
      return;
    }

    const payload: CreateTaskInput = {
      systemId,
      title: values.title.trim(),
      priority: values.priority,
      energyLevel: typeConfig.hideEnergyAndPriority ? undefined : values.energyLevel,
      ...(values.taskType ? { taskType: values.taskType } : {}),
      // startDate/dueDate como ISO en hora local (medianoche si no hay hora).
      ...(values.startDate ? { startDate: dayToLocalISO(values.startDate, values.startTime) } : {}),
      ...(values.dueDate ? { dueDate: dayToLocalISO(values.dueDate, values.dueTime) } : {}),
      ...(values.estimatedMinutes ? { estimatedTime: minutesToTimeString(values.estimatedMinutes) } : {}),
      ...(values.description ? { description: values.description } : {}),
      ...(values.folderId ? { folderId: values.folderId } : {}),
      ...(parentTaskId ? { parentTaskId } : {}),
    };

    try {
      const parent = await createTask(payload);
      const validSubtasks = subtasks.filter((s) => s.title.trim());
      await Promise.allSettled(
        validSubtasks.map((s) =>
          createTask({
            systemId,
            title: s.title.trim(),
            status: 'backlog',
            priority: 'medium',
            energyLevel: 'medium',
            parentTaskId: parent.id,
          }),
        ),
      );
      onTaskCreated?.(parent);
      handleClose(false);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Error al crear la tarea');
    }
  }

  function handleClose(val: boolean) {
    setOpen(val);
    if (!val) {
      form.reset();
      setStep(1);
      setSubtasks([]);
      setDateRange({ from: undefined, to: undefined });
      setSubmitError(null);
      setNlIgnored(false);
    }
  }

  const formContent = (
    <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4 pt-1">
      {/* Step dots */}
      <div className="flex items-center justify-center gap-1.5">
        {([1, 2, 3] as const).map((s) => (
          <div
            key={s}
            className={cn(
              "size-1.5 rounded-full transition-colors",
              step === s ? "bg-primary" : "bg-muted",
            )}
          />
        ))}
      </div>

      {submitError && <p className="text-sm text-destructive">{submitError}</p>}

      {/* ── Step 1: Captura ── */}
      {step === 1 && (
        <div className="flex flex-col gap-4">
          {header}
          <div className="space-y-2">
            <Label htmlFor="title">Título *</Label>
            <Input
              id="title"
              autoFocus
              placeholder="¿Qué hay que hacer?"
              {...form.register('title')}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); nextStep(); } }}
              maxLength={500}
            />
            {form.formState.errors.title && (
              <p className="text-xs text-destructive">{form.formState.errors.title.message}</p>
            )}
            {nlParsed && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <CalendarRange size={12} className="shrink-0" />
                <span>
                  Se programará: {format(new Date(nlParsed.dueDate + 'T00:00:00'), 'EEE d MMM', { locale: es })}
                  {nlParsed.dueTime ? ` · ${nlParsed.dueTime}` : ''}
                </span>
                <button
                  type="button"
                  aria-label="Ignorar fecha detectada"
                  onClick={() => setNlIgnored(true)}
                  className="rounded p-0.5 hover:bg-accent"
                >
                  <X size={12} />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Step 2: Planificación ── */}
      {step === 2 && (
        <div className="flex flex-col gap-4">
          {/* Type picker */}
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

          {/* Priority + Energy */}
          {!typeConfig.hideEnergyAndPriority && (
            <div className="grid grid-cols-2 gap-3">
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
            </div>
          )}

          {/* Dates */}
          {!typeConfig.hideDates && (
            <div className="space-y-2">
              <Label>
                {taskType === 'reminder' ? 'Fecha límite' : 'Fechas'}
              </Label>
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
          )}

          {/* Estimated time */}
          {!typeConfig.hiddenInStep2.includes('estimatedMinutes') && (
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
          )}

          {/* Folder */}
          {folders.length > 0 && (
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
          )}
        </div>
      )}

      {/* ── Step 3: Detalle ── */}
      {step === 3 && (
        <div className="flex flex-col gap-4">
          <div className="space-y-2">
            <Label htmlFor="description">Notas</Label>
            <Textarea
              id="description"
              placeholder="Detalles opcionales..."
              {...form.register('description')}
              className="min-h-[72px] resize-none"
            />
          </div>

          <Separator />

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Subtareas</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-sm text-muted-foreground"
                onClick={() => setSubtasks((prev) => [...prev, { id: crypto.randomUUID(), title: '' }])}
              >
                <Plus size={14} className="mr-1" />
                Agregar
              </Button>
            </div>
            {subtasks.map((sub, i) => (
              <div key={sub.id} className="flex items-center gap-2">
                <Input
                  placeholder={`Subtarea ${i + 1}`}
                  value={sub.title}
                  onChange={(e) => {
                    const updated = [...subtasks];
                    updated[i] = { ...updated[i], title: e.target.value };
                    setSubtasks(updated);
                  }}
                  maxLength={500}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="shrink-0 size-8"
                  onClick={() => setSubtasks((prev) => prev.filter((_, j) => j !== i))}
                >
                  <X size={16} />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Navigation ── */}
      <div className="flex gap-2 pt-1">
        {step > 1 && (
          <Button type="button" variant="ghost" size="icon" onClick={prevStep} className="shrink-0">
            <ChevronLeft size={18} />
          </Button>
        )}
        <Button type="submit" className="flex-1" disabled={isPending}>
          {isPending ? 'Creando...' : 'Guardar'}
        </Button>
        {step < 3 && (
          <Button type="button" variant="outline" size="icon" onClick={nextStep} className="shrink-0">
            <ChevronRight size={18} />
          </Button>
        )}
      </div>
    </form>
  );

  return (
    <ResponsiveDialog open={open} onOpenChange={handleClose}>
      {!isControlled && (
        <Button variant="outline" className="w-fit shrink-0 max-md:px-2.5" onClick={() => setOpen(true)}>
          <Plus className="size-4 md:hidden" />
          <span className="hidden md:inline">Nueva tarea</span>
        </Button>
      )}
      <ResponsiveDialogContent className="max-h-[90vh] overflow-y-auto">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Nueva tarea</ResponsiveDialogTitle>
        </ResponsiveDialogHeader>
        {formContent}
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
