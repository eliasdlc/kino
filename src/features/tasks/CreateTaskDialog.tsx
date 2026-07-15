'use client';

import { useState } from "react";
import { useForm } from "react-hook-form";
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
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { CalendarRange, ChevronLeft, ChevronRight, Plus, X, Sparkles } from 'lucide-react';
import { cn } from "@/lib/utils";
import { Switch } from '@/components/ui/switch';
import type { CreateTaskInput, Task } from "./tasks.types";
import { useCreateTask } from "./tasks.hooks";
import { useFolders } from "@/features/folders/folders.hooks";
import { getTaskTypeConfig } from "./task-type-config";
import { dayToLocalISO } from "./tasks.utils";
import { parseQuickInput, stripAccents } from "./quick-date-parse";
import { minutesToTimeString } from "./EstimatedTimePicker";
import { useQueryClient } from "@tanstack/react-query";
import { SYSTEM_TYPE_CONFIG, type SystemType } from "@/shared/lib/system-types";
import type { System } from "@/features/systems/systems.types";
import { useSprints } from "@/features/sprints/sprints.hooks";
import { TaskPlanningFields } from "./TaskPlanningFields";
import { getTaskDialogFields } from "./task-dialog-config";
import { useTags } from "@/features/tags/tags.hooks";
import { RecurrencePicker } from "./RecurrencePicker";

const formSchema = z.object({
  title: z.string().min(1, "El título es requerido").max(500),
  taskType: z.enum(['task', 'idea', 'event', 'reminder', 'epic']).nullable().optional(),
  priority: z.enum(['critical', 'high', 'medium', 'low']),
  energyLevel: z.enum(['high', 'medium', 'low']),
  startDate: z.string().date().nullable().optional(),
  dueDate: z.string().date().nullable().optional(),
  startTime: z.string().optional(),
  dueTime: z.string().optional(),
  estimatedMinutes: z.number().int().min(1).nullable().optional(),
  description: z.string().optional(),
  folderId: z.string().uuid().nullable().optional(),
  contextTagId: z.string().uuid().nullable().optional(),
  sprintId: z.string().uuid().nullable().optional(),
  recurrenceRule: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
});

export type FormValues = z.infer<typeof formSchema>;

const STEP_FIELDS: Record<1 | 2 | 3, (keyof FormValues)[]> = {
  1: ['title'],
  2: ['priority', 'energyLevel'],
  3: [],
};

const PRIORITY_LABELS: Record<string, string> = {
  critical: "Urgente",
  high: "Alta",
  medium: "Media",
  low: "Baja",
};

function formatDuration(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h > 0 && m > 0) return `${h}h ${m}min`;
  if (h > 0) return `${h}h`;
  return `${m}min`;
}

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
  const [nlIgnoredFields, setNlIgnoredFields] = useState<Set<string>>(new Set());

  const { data: folders = [] } = useFolders(systemId);
  const { mutateAsync: createTask, isPending } = useCreateTask(systemId);
  const { data: tags } = useTags(systemId);
  const queryClient = useQueryClient();

  // Derive energy default from system type (zero-cost: reads from cache)
  const cachedSystems = queryClient.getQueryData<System[]>(['systems']);
  const systemTemplateType = cachedSystems?.find((s) => s.id === systemId)?.templateType as SystemType | undefined;
  const isProjectSystem = systemTemplateType === 'project';
  const { data: sprints = [] } = useSprints(systemId, { enabled: isProjectSystem });
  const dialogFields = getTaskDialogFields(systemTemplateType);
  const taskKinds = systemTemplateType ? SYSTEM_TYPE_CONFIG[systemTemplateType]?.taskKinds ?? [] : [];
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
      contextTagId: null,
      sprintId: null,
      recurrenceRule: null,
      metadata: null,
    },
  });

  const currentMetadata = form.watch('metadata') as Record<string, unknown> | null;

  const taskType = form.watch('taskType');
  const typeConfig = getTaskTypeConfig(taskType);

  // Parser reactivo en tiempo real — detecta tokens en el título mientras el usuario escribe.
  const rawNlParsed = parseQuickInput(form.watch('title'));

  const showDateChip = !!(rawNlParsed?.dueDate && !nlIgnoredFields.has('dueDate'));
  const showPriorityChip = !!(rawNlParsed?.priority && !nlIgnoredFields.has('priority'));
  const showSystemChip = !!(rawNlParsed?.systemHint && !nlIgnoredFields.has('systemHint'));
  const showTagChip = !!(rawNlParsed?.tagHint && !nlIgnoredFields.has('tagHint'));
  const showDurationChip = !!(rawNlParsed?.estimatedMinutes && !nlIgnoredFields.has('estimatedMinutes'));
  const hasNlChips = showDateChip || showPriorityChip || showSystemChip || showTagChip || showDurationChip;

  function dismissNlField(field: string) {
    setNlIgnoredFields((prev) => new Set([...prev, field]));
  }

  function applyNlParse() {
    if (!rawNlParsed) return;

    // Limpiar el título quitando todos los tokens detectados
    form.setValue('title', rawNlParsed.title);

    // Fecha/hora — solo aplicar si no hay fecha ya puesta (evita pisar edición manual en paso 2)
    if (rawNlParsed.dueDate && !nlIgnoredFields.has('dueDate') &&
        !form.getValues('startDate') && !form.getValues('dueDate')) {
      const day = new Date(rawNlParsed.dueDate + 'T00:00:00');
      form.setValue('startDate', rawNlParsed.dueDate);
      form.setValue('dueDate', rawNlParsed.dueDate);
      if (rawNlParsed.dueTime) form.setValue('dueTime', rawNlParsed.dueTime);
      setDateRange({ from: day, to: day });
    }

    // Prioridad
    if (rawNlParsed.priority && !nlIgnoredFields.has('priority')) {
      form.setValue('priority', rawNlParsed.priority);
    }

    // Duración estimada
    if (rawNlParsed.estimatedMinutes && !nlIgnoredFields.has('estimatedMinutes')) {
      form.setValue('estimatedMinutes', rawNlParsed.estimatedMinutes);
    }

    // Etiqueta — resolver tagHint → contextTagId por nombre (insensible a mayúsculas/acentos)
    if (rawNlParsed.tagHint && !nlIgnoredFields.has('tagHint') &&
        !form.getValues('contextTagId') && tags) {
      const norm = (s: string) => stripAccents(s).toLowerCase();
      const matched = tags.find((t) => norm(t.title) === norm(rawNlParsed.tagHint!));
      if (matched) form.setValue('contextTagId', matched.id);
    }

    // systemHint: se muestra en el chip como pista visual pero no cambia el sistema
    // (el sistema lo controla el Select en el header de GlobalQuickAddDialog)
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
    if (step === 1 && rawNlParsed) {
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
      ...(values.contextTagId ? { contextTagId: values.contextTagId } : {}),
      ...(values.sprintId ? { sprintId: values.sprintId } : {}),
      ...(values.recurrenceRule ? { recurrenceRule: values.recurrenceRule } : {}),
      ...(values.metadata ? { metadata: values.metadata } : {}),
      ...(parentTaskId ? { parentTaskId } : {}),
    };

    try {
      const parent = await createTask(payload);
      
      const studyTasks = [];
      const meta = payload.metadata as Record<string, unknown> | undefined;
      const isExamOrQuiz = meta?.eventSubtype === 'exam' || meta?.eventSubtype === 'quiz';
      
      if (isExamOrQuiz && meta?.generateStudyPlan && payload.startDate) {
        const start = new Date(payload.startDate);
        // Study Task 1: 5 days before
        const d1 = new Date(start);
        d1.setDate(d1.getDate() - 5);
        studyTasks.push({
            systemId,
            title: `Repaso 1: ${payload.title}`,
            status: 'backlog' as const,
            priority: 'high' as const,
            energyLevel: 'high' as const,
            taskType: 'task' as const,
            startDate: d1.toISOString(),
            dueDate: d1.toISOString(),
            parentTaskId: parent.id,
        });

        // Study Task 2: 2 days before
        const d2 = new Date(start);
        d2.setDate(d2.getDate() - 2);
        studyTasks.push({
            systemId,
            title: `Repaso Final: ${payload.title}`,
            status: 'backlog' as const,
            priority: 'high' as const,
            energyLevel: 'high' as const,
            taskType: 'task' as const,
            startDate: d2.toISOString(),
            dueDate: d2.toISOString(),
            parentTaskId: parent.id,
        });
      }

      const validSubtasks = subtasks.filter((s) => s.title.trim());
      await Promise.allSettled([
        ...validSubtasks.map((s) =>
          createTask({
            systemId,
            title: s.title.trim(),
            status: 'backlog',
            priority: 'medium',
            energyLevel: 'medium',
            parentTaskId: parent.id,
          }),
        ),
        ...studyTasks.map((t) => createTask(t))
      ]);
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
      setNlIgnoredFields(new Set());
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
            {hasNlChips && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                {showDateChip && (
                  <span className="flex items-center gap-1">
                    <CalendarRange size={12} className="shrink-0" />
                    {format(new Date(rawNlParsed!.dueDate! + 'T00:00:00'), 'EEE d MMM', { locale: es })}
                    {rawNlParsed!.dueTime ? ` · ${rawNlParsed!.dueTime}` : ''}
                    <button
                      type="button"
                      aria-label="Ignorar fecha detectada"
                      onClick={() => dismissNlField('dueDate')}
                      className="rounded p-0.5 hover:bg-accent"
                    >
                      <X size={12} />
                    </button>
                  </span>
                )}
                {showPriorityChip && (
                  <span className="flex items-center gap-1">
                    {PRIORITY_LABELS[rawNlParsed!.priority!]}
                    <button
                      type="button"
                      aria-label="Ignorar prioridad detectada"
                      onClick={() => dismissNlField('priority')}
                      className="rounded p-0.5 hover:bg-accent"
                    >
                      <X size={12} />
                    </button>
                  </span>
                )}
                {showSystemChip && (
                  <span className="flex items-center gap-1">
                    @{rawNlParsed!.systemHint}
                    <button
                      type="button"
                      aria-label="Ignorar sistema detectado"
                      onClick={() => dismissNlField('systemHint')}
                      className="rounded p-0.5 hover:bg-accent"
                    >
                      <X size={12} />
                    </button>
                  </span>
                )}
                {showTagChip && (
                  <span className="flex items-center gap-1">
                    #{rawNlParsed!.tagHint}
                    <button
                      type="button"
                      aria-label="Ignorar etiqueta detectada"
                      onClick={() => dismissNlField('tagHint')}
                      className="rounded p-0.5 hover:bg-accent"
                    >
                      <X size={12} />
                    </button>
                  </span>
                )}
                {showDurationChip && (
                  <span className="flex items-center gap-1">
                    {formatDuration(rawNlParsed!.estimatedMinutes!)}
                    <button
                      type="button"
                      aria-label="Ignorar duración detectada"
                      onClick={() => dismissNlField('estimatedMinutes')}
                      className="rounded p-0.5 hover:bg-accent"
                    >
                      <X size={12} />
                    </button>
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Step 2: Planificación ── */}
      {step === 2 && (
        <div className="flex flex-col gap-4">
        {taskKinds.length > 0 && (
          <div className="space-y-2">
            <Label>Tipo</Label>
            <div className="flex flex-wrap gap-1.5">
              {taskKinds.map((kind) => {
                const KindIcon = kind.icon;
                const active = (currentMetadata?.kind as string | undefined) === kind.id;
                return (
                  <button
                    key={kind.id}
                    type="button"
                    onClick={() => {
                      const meta = (form.getValues('metadata') as Record<string, unknown>) || {};
                      form.setValue(
                        'metadata',
                        active ? { ...meta, kind: undefined } : { ...meta, kind: kind.id },
                      );
                    }}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors",
                      active
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border text-muted-foreground hover:border-primary/50",
                    )}
                  >
                    <KindIcon size={14} />
                    {kind.label}
                  </button>
                );
              })}
            </div>
            {(() => {
              const activeKind = taskKinds.find((k) => k.id === (currentMetadata?.kind as string | undefined));
              if (!activeKind || activeKind.fields.length === 0) return null;
              return (
                <div className="grid grid-cols-1 gap-2 pt-1">
                  {activeKind.fields.map((field) => (
                    <Input
                      key={field.id}
                      type={field.input === "date" ? "date" : field.input === "number" ? "number" : "text"}
                      placeholder={field.label}
                      value={(currentMetadata?.[field.id] as string | undefined) ?? ""}
                      onChange={(e) => {
                        const meta = (form.getValues("metadata") as Record<string, unknown>) || {};
                        form.setValue("metadata", { ...meta, [field.id]: e.target.value });
                      }}
                    />
                  ))}
                </div>
              );
            })()}
          </div>
        )}
        <TaskPlanningFields
          form={form}
          systemId={systemId}
          systemTemplateType={systemTemplateType}
          fields={dialogFields}
          typeConfig={typeConfig}
          taskType={taskType}
          folders={folders}
          sprints={sprints}
          dateRange={dateRange}
          setDateRange={setDateRange}
        />
        </div>
      )}

      {/* ── Step 3: Detalle ── */}
      {step === 3 && (
        <div className="flex flex-col gap-4">
          <div className="space-y-2">
            {(() => {
              const meta = currentMetadata;
              const isExamOrQuiz = meta?.eventSubtype === 'exam' || meta?.eventSubtype === 'quiz';
              return (
                <>
                  <Label htmlFor="description">{isExamOrQuiz ? 'Temario a estudiar' : 'Notas'}</Label>
                  <Textarea
                    id="description"
                    placeholder={isExamOrQuiz ? "Temas principales..." : "Detalles opcionales..."}
                    {...form.register('description')}
                    className="min-h-[72px] resize-none"
                  />
                  {isExamOrQuiz && (
                    <div className="flex items-center justify-between gap-2 p-3 mt-2 border rounded-lg bg-muted/20">
                      <div className="space-y-0.5">
                        <Label className="flex items-center gap-1.5"><Sparkles size={14} className="text-amber-500" /> Plan de Estudio</Label>
                        <p className="text-[11px] text-muted-foreground">Auto-generar tareas de repaso antes de la fecha.</p>
                      </div>
                      <Switch
                        checked={!!meta?.generateStudyPlan}
                        onCheckedChange={(checked) => {
                          const currentMetadata = (form.getValues('metadata') as Record<string, unknown>) || {};
                          form.setValue('metadata', { ...currentMetadata, generateStudyPlan: checked });
                        }}
                      />
                    </div>
                  )}
                </>
              );
            })()}
          </div>

          <Separator />

          <div className="space-y-2">
            <Label>Repetición</Label>
            <RecurrencePicker
              value={form.watch('recurrenceRule')}
              onChange={(rule) => form.setValue('recurrenceRule', rule)}
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
