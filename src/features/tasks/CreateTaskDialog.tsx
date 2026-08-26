'use client';

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
import { Separator } from "@/components/ui/separator";
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { cn } from "@/lib/utils";
import type { TaskTransport } from "./tasks.types";
import { useCreateTask } from "./tasks.hooks";
import { useFolders } from "@/features/folders/folders.hooks";
import { getTaskTypeConfig } from "./task-type-config";
import { parseQuickInput, stripAccents } from "./quick-date-parse";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useOnlineStatus } from "@/features/offline/offline.hooks";
import { type SystemType } from "@/shared/lib/system-types";
import { resolveSystemManifest } from "@/shared/lib/system-manifest";
import type { System } from "@/features/systems/systems.types";
import { useSprints } from "@/features/sprints/sprints.hooks";
import { TaskPlanningFields } from "./TaskPlanningFields";
import { getTaskDialogFields } from "./task-dialog-config";
import { useTags } from "@/features/tags/tags.hooks";
import { RecurrencePicker } from "./RecurrencePicker";
import {
  STEP_FIELDS,
  buildCreateTaskPayload,
  buildStudyPlanTasks,
  formSchema,
  type FormValues,
} from "./create-task.helpers";
import {
  DescriptionField,
  NlChips,
  SubtaskEditor,
  TaskKindField,
} from "./CreateTaskFields";

export type { FormValues } from "./create-task.helpers";

interface CreateTaskDialogProps {
  systemId: string;
  parentTaskId?: string;
  folderId?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  header?: React.ReactNode;
  onTaskCreated?: (task: TaskTransport) => void;
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
  const { mutateAsync: createTask, mutate: createTaskSync, isPending } = useCreateTask(systemId);
  const isOnline = useOnlineStatus();
  const { data: tags } = useTags(systemId);
  const queryClient = useQueryClient();

  // Derive energy default from system type (zero-cost: reads from cache)
  const cachedSystems = queryClient.getQueryData<System[]>(['systems']);
  const cachedSystem = cachedSystems?.find((s) => s.id === systemId);
  const systemTemplateType = cachedSystem?.templateType as SystemType | undefined;
  const isProjectSystem = systemTemplateType === 'project';
  const { data: sprints = [] } = useSprints(systemId, { enabled: isProjectSystem });
  const dialogFields = getTaskDialogFields(systemTemplateType);
  // Manifiesto EFECTIVO: en un sistema custom los kinds los compuso el usuario.
  const manifest = resolveSystemManifest(cachedSystem);
  const taskKinds = manifest.taskKinds;
  const rawEnergyDefault = manifest.energyDefault;
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

  function dismissNlField(field: string) {
    setNlIgnoredFields((prev) => new Set([...prev, field]));
  }

  function setMetadata(next: Record<string, unknown> | null) {
    form.setValue('metadata', next);
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

    const payload = buildCreateTaskPayload(values, {
      systemId,
      parentTaskId,
      hideEnergyAndPriority: !!typeConfig.hideEnergyAndPriority,
    });

    // Sin conexión (KIN-57) la mutación se encola y su promesa no resuelve hasta
    // que vuelva la red: esperarla dejaría el diálogo colgado con el spinner
    // puesto y la idea sin escribir en ningún sitio. Se dispara sin await y se
    // cierra, que es justo lo que se espera de una captura rápida.
    //
    // Lo que se degrada a propósito: subtareas y plan de estudio. Ambos cuelgan
    // del id real que devuelve el servidor, y offline ese id todavía no existe.
    // La tarea principal —lo que el usuario vino a capturar— sí se guarda.
    if (!isOnline) {
      createTaskSync(payload);
      const pendientes = subtasks.filter((s) => s.title.trim()).length;
      if (pendientes > 0) {
        toast.info(
          `Las ${pendientes} subtareas se crean al volver la conexión: escríbelas cuando la tarea haya subido`,
        );
      }
      handleClose(false);
      return;
    }

    try {
      const parent = await createTask(payload);

      const studyTasks = buildStudyPlanTasks(payload, parent.id, systemId);

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
            <NlChips
              parsed={rawNlParsed}
              ignoredFields={nlIgnoredFields}
              onDismiss={dismissNlField}
            />
          </div>
        </div>
      )}

      {/* ── Step 2: Planificación ── */}
      {step === 2 && (
        <div className="flex flex-col gap-4">
          <TaskKindField
            taskKinds={taskKinds}
            metadata={currentMetadata}
            onMetadataChange={setMetadata}
          />
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
          <DescriptionField
            metadata={currentMetadata}
            register={form.register('description')}
            onToggleStudyPlan={(checked) =>
              setMetadata({ ...(form.getValues('metadata') ?? {}), generateStudyPlan: checked })
            }
          />

          <Separator />

          <div className="space-y-2">
            <Label>Repetición</Label>
            <RecurrencePicker
              value={form.watch('recurrenceRule')}
              onChange={(rule) => form.setValue('recurrenceRule', rule)}
            />
          </div>

          <Separator />

          <SubtaskEditor subtasks={subtasks} onChange={setSubtasks} />
        </div>
      )}

      {/* ── Navigation ── */}
      <div className="flex gap-2 pt-1">
        {step > 1 && (
          <Button type="button" variant="ghost" size="icon" aria-label="Paso anterior" onClick={prevStep} className="shrink-0">
            <ChevronLeft size={18} />
          </Button>
        )}
        <Button type="submit" className="flex-1" disabled={isPending}>
          {isPending ? 'Creando...' : 'Guardar'}
        </Button>
        {step < 3 && (
          <Button type="button" variant="outline" size="icon" aria-label="Paso siguiente" onClick={nextStep} className="shrink-0">
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
