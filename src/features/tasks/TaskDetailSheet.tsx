"use client";

import { useEffect, useRef, useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { isFutureExamOrQuiz, parseDueDate } from "./tasks.utils";
import { Check, Timer } from "lucide-react";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { MarginRow } from "@/components/ui/margin-row";
import { cn } from "@/lib/utils";
import {
  ENERGY_LEVEL_VALUES,
  TASK_PRIORITY_VALUES,
} from "@/shared/types/enums";
import type { TaskTypeValue } from "@/shared/types/enums";
import { SubtaskList } from "./SubtaskList";
import { ItemEventList } from "./ItemEventList";
import { TaskRemindersSection } from "./TaskRemindersSection";
import { useToggleTask, useUpdateTask } from "./tasks.hooks";
import { useTachar } from "./useTachar";
import { RecurrencePicker } from "./RecurrencePicker";
import { useFolders } from "@/features/folders/folders.hooks";
import { useSprints } from "@/features/sprints/sprints.hooks";
import { TaskTypePicker } from "./TaskTypePicker";
import { TagPicker } from "@/features/tags/TagPicker";
import { TagAffordance } from "@/features/tags/TagAffordance";
import { BodyGate } from "./BodyGate";
import { useCreateTag } from "@/features/tags/tags.hooks";
import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { toast } from "sonner";
import type { TaskTransport } from "./tasks.types";
import { useFocusTimer } from "./FocusTimerProvider";
import { useSystems } from "@/features/systems/systems.hooks";
import type { SystemType } from "@/shared/lib/system-types";
import { buildDirtyTaskData, needsGradeField } from "./task-detail.helpers";
import { ENERGY_WORD, PRIORITY_WORD } from "./task-vocab";
import { Fichas } from "./Fichas";
import {
  DateTimeField,
  DetailRow,
  ExportTaskJsonButton,
  GradeField,
  ClosingSignature,
  TimeLoggedSection,
} from "./TaskDetailFields";

const PRIORIDADES = TASK_PRIORITY_VALUES.map((value) => ({ value, label: PRIORITY_WORD[value]! }));
const ENERGIAS = ENERGY_LEVEL_VALUES.map((value) => ({ value, label: ENERGY_WORD[value]! }));

/**
 * La categoría es `TagPicker` (de sistemas), con fichas de 28 px. Aquí, desde
 * fuera, sus fichas y su campo miden 48 px con el dedo y vuelven a su tamaño
 * con ratón; el cambio de fondo es de sistemas.
 */
const CATEGORIA_TACTIL =
  "py-1.5 [&_button]:min-h-[2.85rem] [&_button]:px-3.5 [&_button]:text-sm [&_input]:min-h-[2.85rem] [&_input]:text-sm md:pointer-fine:[&_button]:min-h-8 md:pointer-fine:[&_button]:px-2.5 md:pointer-fine:[&_button]:text-xs md:pointer-fine:[&_input]:min-h-8";

interface TaskDetailSheetProps {
  task: TaskTransport | null;
  systemId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Quien pinta la fila la tacha: así la fila de debajo queda tachada en su
   * sitio con su Deshacer. Sin él, la hoja completa por su cuenta y ofrece el
   * Deshacer en el aviso.
   */
  onComplete?: (task: TaskTransport) => void;
}

interface TaskDetailFormProps {
  task: TaskTransport;
  systemId: string;
  onClose: () => void;
  onComplete?: (task: TaskTransport) => void;
}

function TaskDetailForm({ task, systemId, onClose, onComplete }: TaskDetailFormProps) {
  const isMobile = useIsMobile();
  const { mutate: updateTask } = useUpdateTask(systemId);
  const { mutate: toggleTask } = useToggleTask(systemId);
  const { handleToggle: completarEnSitio } = useTachar(toggleTask);
  const { data: folders = [] } = useFolders(systemId);
  const { data: sprints = [] } = useSprints(systemId);
  const activeSprints = sprints.filter((s) => s.status === "active");

  const { state: timerState, openModeDialog } = useFocusTimer();
  const isThisRunning = timerState.taskId === task.id && timerState.phase !== 'idle';
  const anotherRunning = timerState.phase !== 'idle' && !isThisRunning;
  const isDone = task.status === "done";

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
  const titleRef = useRef<HTMLTextAreaElement>(null);

  // Las dos puertas del vocabulario que viven en este campo. Se crean con las
  // mutaciones crudas porque las dos encadenan dos escrituras y necesitan el id
  // que devuelve la primera.
  const createPage = useMutation(api.pages.create);
  const linkPage = useMutation(api.pages.linkTask);
  const { mutate: createTag } = useCreateTag(systemId);

  /** El cuerpo se va a una página del sistema y queda enlazado a esta tarea. */
  async function convertBodyToPage() {
    const body = description;
    const page = await createPage({ systemId, title: title.trim() || undefined, content: body });
    await linkPage({ id: page.id, taskId: task.id });
    setDescription("");
    toast.success("El cuerpo vive en una página, enlazada a esta tarea");
  }

  /** La almohadilla se vuelve una etiqueta de verdad, ya puesta en la tarea. */
  function createTagFromHash(name: string) {
    createTag(
      { title: name },
      { onSuccess: (tag: { id: string }) => setContextTagId(tag.id) },
    );
  }

  const { data: cachedSystems } = useSystems();
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

  // Un solo contrato de guardado: todo se guarda solo. Lo que quede escrito
  // al cerrar (antes del segundo y medio del autoguardado) se guarda al
  // desmontar, en vez de perderse con el temporizador.
  const pendienteRef = useRef<() => void>(() => {});
  pendienteRef.current = () => {
    if (!title.trim()) return;
    const data = buildDirtyData();
    if (Object.keys(data).length > 0) updateTaskRef.current({ taskId: task.id, data });
  };
  useEffect(() => () => pendienteRef.current(), []);

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

  /**
   * Completar desde la hoja: guarda lo que quedara sin guardar, tacha la fila
   * en su sitio (con su Deshacer) y la hoja se recoge. Si quien la abre pinta
   * la fila con otra lista, `onComplete` la tacha por él.
   */
  function handleComplete() {
    if (isFutureExamOrQuiz(task)) {
      toast.error("No puedes completar este evento antes de que suceda.");
      return;
    }
    pendienteRef.current();
    pendienteRef.current = () => {};
    if (onComplete) onComplete(task);
    else completarEnSitio(task);
    onClose();
  }

  const folderOptions = [{ value: "none", label: "Sin carpeta" }, ...folders.map((f) => ({ value: f.id, label: f.name }))];
  const sprintOptions = [{ value: "none", label: "Sin ciclo" }, ...activeSprints.map((s) => ({ value: s.id, label: s.name }))];

  return (
    <div className="flex flex-col">
      {/* El título, con el círculo en el margen: la misma fila que en la lista,
          en grande. Sin caja: Bricolage sobre el papel, y el foco lo dice el
          anillo único. */}
      <MarginRow
        margin={
          isDone ? (
            <span className="flex size-[2.85rem] items-center justify-center" aria-hidden>
              <span className="flex size-[1.35rem] items-center justify-center rounded-full border-[1.6px] border-task-done bg-task-done text-task-done-foreground">
                <Check className="size-3" strokeWidth={3} />
              </span>
            </span>
          ) : (
            <button
              type="button"
              onClick={handleComplete}
              aria-label={`Completar ${task.title}`}
              className="press focus-ring flex size-[2.85rem] items-center justify-center rounded-full transition-transform duration-(--dur-toque) ease-(--ease-pluma)"
            >
              <span className="size-[1.35rem] rounded-full border-[1.6px] border-input" aria-hidden />
            </button>
          )
        }
        className="items-start border-b-0"
      >
        <label htmlFor="task-title" className="sr-only">
          Título
        </label>
        <textarea
          id="task-title"
          ref={titleRef}
          rows={1}
          value={title}
          onChange={(e) => setTitle(e.target.value.replace(/\n/g, " "))}
          onKeyDown={(e) => {
            // El título es una línea: Enter no parte el renglón.
            if (e.key === "Enter") e.preventDefault();
          }}
          maxLength={500}
          // En el teléfono el autofocus abre el teclado al entrar a *ver* la
          // tarea y tapa media pantalla; sólo tiene sentido con teclado físico.
          autoFocus={!isMobile}
          className={cn(
            "focus-ring field-sizing-content block w-full resize-none rounded-md bg-transparent font-display text-[1.5rem] leading-[1.15] font-bold tracking-[-0.02em] outline-none",
            isDone && "text-muted-foreground line-through decoration-input",
          )}
        />
        <label htmlFor="task-desc" className="sr-only">
          Notas
        </label>
        <textarea
          id="task-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Notas, si hacen falta"
          className="focus-ring field-sizing-content mt-2 block min-h-[3.2rem] w-full resize-none rounded-md bg-transparent font-voice text-[1.05rem] leading-relaxed text-body outline-none placeholder:text-muted-foreground"
        />
        {/* Las palabras aparecen donde ocurrió el gesto, no en Hoy. */}
        <BodyGate body={description} onConvert={() => void convertBodyToPage()} />
        <TagAffordance text={description} onCreate={createTagFromHash} />
      </MarginRow>

      <div className="border-t border-input">
        <DetailRow label="Tipo">
          <div className="py-1.5">
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
        </DetailRow>

        {/* Categoría (context_tag): permite crear categorías inline. */}
        <DetailRow label="Categoría">
          <div className={CATEGORIA_TACTIL}>
            <TagPicker systemId={systemId} value={contextTagId} onChange={setContextTagId} allowCreate />
          </div>
        </DetailRow>

        <DetailRow label="Prioridad" id="prioridad-rotulo">
          <div className="space-y-1 py-1.5">
            <Fichas label="Prioridad" labelledBy="prioridad-rotulo" options={PRIORIDADES} selected={[priority]} onToggle={(v) => setPriority(v)} />
            {/* Lo que se elige es la importancia; la urgencia la pone la fecha. */}
            {task.priorityRaised && priority === task.priority && (
              <p className="text-sm text-muted-foreground">
                Por la fecha, ahora cuenta como {PRIORITY_WORD[task.effectivePriority]?.toLowerCase()}.
              </p>
            )}
          </div>
        </DetailRow>

        <DetailRow label="Energía" id="energia-rotulo">
          <div className="py-1.5">
            <Fichas label="Energía" labelledBy="energia-rotulo" options={ENERGIAS} selected={[energyLevel]} onToggle={(v) => setEnergyLevel(v)} />
          </div>
        </DetailRow>

        {folders.length > 0 && (
          <DetailRow label="En" id="carpeta-rotulo">
            <div className="py-1.5">
              <Fichas label="Carpeta" labelledBy="carpeta-rotulo" options={folderOptions} selected={[selectedFolderId]} onToggle={setSelectedFolderId} />
            </div>
          </DetailRow>
        )}

        {activeSprints.length > 0 && (
          <DetailRow label="Ciclo" id="ciclo-rotulo">
            <div className="py-1.5">
              <Fichas label="Ciclo" labelledBy="ciclo-rotulo" options={sprintOptions} selected={[sprintId]} onToggle={setSprintId} />
            </div>
          </DetailRow>
        )}

        <DateTimeField label="Empieza" titulo="Fecha de inicio" timeInputId="start-time" value={startDate} onChange={setStartDate} />
        <DateTimeField label="Vence" titulo="Fecha de vencimiento" timeInputId="due-time" value={dueDate} onChange={setDueDate} />

        <DetailRow label="Repite" id="repite-rotulo">
          <div className="py-1.5">
            <RecurrencePicker value={recurrenceRule} onChange={setRecurrenceRule} labelledBy="repite-rotulo" />
          </div>
        </DetailRow>

        {needsGradeField(isDone, taskType, metadata) && <GradeField metadata={metadata} onChange={setMetadata} />}

        <DetailRow label="Subtareas">
          <SubtaskList parentTaskId={task.id} systemId={systemId} />
        </DetailRow>

        <TaskRemindersSection task={task} />

        <TimeLoggedSection taskId={task.id} />

        <ClosingSignature task={task} />

        <DetailRow label="Actividad">
          <div className="py-1.5">
            <ItemEventList targetType="task" targetId={task.id} />
          </div>
        </DetailRow>

        <div className="flex justify-end py-2">
          <ExportTaskJsonButton task={task} />
        </div>
      </div>

      {/* El pie de la hoja: completar y el foco quedan al alcance del pulgar,
          pegados abajo mientras el resto se desplaza. Guardar no tiene botón:
          todo se guarda solo, y lo que quede pendiente se guarda al cerrar. */}
      <div
        data-slot="task-detail-actions"
        className="sticky bottom-0 z-10 -mx-4 -mb-[calc(1rem+env(safe-area-inset-bottom))] mt-2 flex flex-col gap-2 border-t border-border bg-popover px-4 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))] md:-mx-5 md:-mb-5 md:flex-row md:px-5 md:pb-5"
      >
        <span className="sr-only" aria-live="polite">
          {saveStatus === "saved" ? "Guardado" : ""}
        </span>
        {!isDone ? (
          <>
            <Button size="lg" className="md:flex-1" onClick={handleComplete}>
              <Check className="size-5" />
              Marcar como hecha
            </Button>
            <Button
              size="lg"
              variant="secondary"
              onClick={() => !anotherRunning && openModeDialog({ id: task.id, title: task.title, systemId })}
              disabled={anotherRunning}
              className={cn("md:flex-1", isThisRunning && "text-primary")}
            >
              <Timer className="size-5" />
              {isThisRunning ? "En foco" : "Iniciar foco"}
            </Button>
          </>
        ) : (
          <p className="py-2 text-center text-sm text-muted-foreground md:flex-1">Hecha. Los cambios se guardan solos.</p>
        )}
        {saveStatus === "saved" && !isDone && (
          <p className="text-center text-xs text-muted-foreground md:hidden">Guardado</p>
        )}
      </div>
    </div>
  );
}

/**
 * El detalle de una tarea es una hoja (en el teléfono, la hoja inferior; en
 * escritorio, un diálogo) que se abre sobre la lista sin moverla. Cada dato es
 * un renglón de margen: el rótulo en el margen, el valor en la columna de
 * texto. Completar es su acción primaria y vive en el pie, pegado abajo: la
 * hoja se recoge y deja la fila tachada debajo, que se queda en su sitio hasta
 * la siguiente visita.
 *
 * La hoja conserva la última tarea mientras se recoge: quien la abre pone
 * `task` a null al cerrar, y si el formulario se desmontara en ese instante el
 * panel se vaciaría a mitad de la salida.
 */
export function TaskDetailSheet({ task, systemId, open, onOpenChange, onComplete }: TaskDetailSheetProps) {
  const [ultima, setUltima] = useState<TaskTransport | null>(task);
  if (task && task !== ultima) setUltima(task);
  const mostrada = task ?? ultima;
  const [ultimoSistema, setUltimoSistema] = useState(systemId);
  if (task && systemId && systemId !== ultimoSistema) setUltimoSistema(systemId);

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle className="pl-(--margen) font-sans text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase">
            Tarea
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription className="sr-only">
            El detalle de la tarea. Los cambios se guardan solos.
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        {mostrada && (
          <TaskDetailForm
            key={mostrada.id}
            task={mostrada}
            systemId={task ? systemId : ultimoSistema}
            onClose={() => onOpenChange(false)}
            onComplete={onComplete}
          />
        )}
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
