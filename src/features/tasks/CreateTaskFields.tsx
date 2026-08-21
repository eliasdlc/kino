'use client';

import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarRange, Plus, X, Sparkles } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from '@/components/ui/switch';
import { cn } from "@/lib/utils";
import type { ParsedQuickInput } from "./quick-date-parse";
import { PRIORITY_LABELS, formatDuration, nlChipVisibility } from "./create-task.helpers";

/**
 * Secciones del diálogo de crear tarea (KIN-146 · FE-05).
 * Extraídas de `CreateTaskDialog` tal cual: los cinco chips del parser eran el
 * mismo bloque repetido con otro contenido, y ahora salen de una sola pieza.
 */

function DismissibleChip({
  label,
  ariaLabel,
  icon,
  onDismiss,
}: {
  label: React.ReactNode;
  ariaLabel: string;
  icon?: React.ReactNode;
  onDismiss: () => void;
}) {
  return (
    <span className="flex items-center gap-1">
      {icon}
      {label}
      <button
        type="button"
        aria-label={ariaLabel}
        onClick={onDismiss}
        className="rounded p-0.5 hover:bg-accent"
      >
        <X size={12} />
      </button>
    </span>
  );
}

/** Lo que el parser detectó en el título, con su X para descartarlo. */
export function NlChips({
  parsed,
  ignoredFields,
  onDismiss,
}: {
  parsed: ParsedQuickInput | null | undefined;
  ignoredFields: Set<string>;
  onDismiss: (field: string) => void;
}) {
  const show = nlChipVisibility(parsed, ignoredFields);
  if (!parsed || !show.any) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
      {show.date && (
        <DismissibleChip
          ariaLabel="Ignorar fecha detectada"
          icon={<CalendarRange size={12} className="shrink-0" />}
          label={`${format(new Date(parsed.dueDate! + 'T00:00:00'), 'EEE d MMM', { locale: es })}${parsed.dueTime ? ` · ${parsed.dueTime}` : ''}`}
          onDismiss={() => onDismiss('dueDate')}
        />
      )}
      {show.priority && (
        <DismissibleChip
          ariaLabel="Ignorar prioridad detectada"
          label={PRIORITY_LABELS[parsed.priority!]}
          onDismiss={() => onDismiss('priority')}
        />
      )}
      {show.system && (
        <DismissibleChip
          ariaLabel="Ignorar sistema detectado"
          label={`@${parsed.systemHint}`}
          onDismiss={() => onDismiss('systemHint')}
        />
      )}
      {show.tag && (
        <DismissibleChip
          ariaLabel="Ignorar etiqueta detectada"
          label={`#${parsed.tagHint}`}
          onDismiss={() => onDismiss('tagHint')}
        />
      )}
      {show.duration && (
        <DismissibleChip
          ariaLabel="Ignorar duración detectada"
          label={formatDuration(parsed.estimatedMinutes!)}
          onDismiss={() => onDismiss('estimatedMinutes')}
        />
      )}
    </div>
  );
}

interface TaskKind {
  id: string;
  label: string;
  icon: React.ComponentType<{ size?: number }>;
  fields: { id: string; label: string; input: string }[];
}

/** Los kinds del arquetipo y los campos propios del kind activo. */
export function TaskKindField({
  taskKinds,
  metadata,
  onMetadataChange,
}: {
  taskKinds: TaskKind[];
  metadata: Record<string, unknown> | null;
  onMetadataChange: (next: Record<string, unknown>) => void;
}) {
  if (taskKinds.length === 0) return null;

  const activeKindId = metadata?.kind as string | undefined;
  const activeKind = taskKinds.find((k) => k.id === activeKindId);

  return (
    <div className="space-y-2">
      <Label>Tipo</Label>
      <div className="flex flex-wrap gap-1.5">
        {taskKinds.map((kind) => {
          const KindIcon = kind.icon;
          const active = activeKindId === kind.id;
          return (
            <button
              key={kind.id}
              type="button"
              onClick={() =>
                onMetadataChange(
                  active
                    ? { ...(metadata ?? {}), kind: undefined }
                    : { ...(metadata ?? {}), kind: kind.id },
                )
              }
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
      {activeKind && activeKind.fields.length > 0 && (
        <div className="grid grid-cols-1 gap-2 pt-1">
          {activeKind.fields.map((field) => (
            <Input
              key={field.id}
              type={field.input === "date" ? "date" : field.input === "number" ? "number" : "text"}
              placeholder={field.label}
              value={(metadata?.[field.id] as string | undefined) ?? ""}
              onChange={(e) => onMetadataChange({ ...(metadata ?? {}), [field.id]: e.target.value })}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/** Notas de la tarea; en exámenes y quizzes cambia de tono y ofrece el plan de estudio. */
export function DescriptionField({
  metadata,
  register,
  onToggleStudyPlan,
}: {
  metadata: Record<string, unknown> | null;
  register: React.ComponentProps<typeof Textarea>;
  onToggleStudyPlan: (checked: boolean) => void;
}) {
  const isExamOrQuiz = metadata?.eventSubtype === 'exam' || metadata?.eventSubtype === 'quiz';

  return (
    <div className="space-y-2">
      <Label htmlFor="description">{isExamOrQuiz ? 'Temario a estudiar' : 'Notas'}</Label>
      <Textarea
        id="description"
        placeholder={isExamOrQuiz ? "Temas principales..." : "Detalles opcionales..."}
        className="min-h-[72px] resize-none"
        {...register}
      />
      {isExamOrQuiz && (
        <div className="flex items-center justify-between gap-2 p-3 mt-2 border rounded-lg bg-muted/20">
          <div className="space-y-0.5">
            <Label className="flex items-center gap-1.5">
              <Sparkles size={14} className="text-amber-500" /> Plan de Estudio
            </Label>
            <p className="text-[11px] text-muted-foreground">
              Auto-generar tareas de repaso antes de la fecha.
            </p>
          </div>
          <Switch checked={!!metadata?.generateStudyPlan} onCheckedChange={onToggleStudyPlan} />
        </div>
      )}
    </div>
  );
}

/** Subtareas que se crean junto con la tarea. */
export function SubtaskEditor({
  subtasks,
  onChange,
}: {
  subtasks: Array<{ id: string; title: string }>;
  onChange: (next: Array<{ id: string; title: string }>) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>Subtareas</Label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 text-sm text-muted-foreground"
          onClick={() => onChange([...subtasks, { id: crypto.randomUUID(), title: '' }])}
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
              onChange(updated);
            }}
            maxLength={500}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0 size-8"
            aria-label="Quitar esta subtarea"
            onClick={() => onChange(subtasks.filter((_, j) => j !== i))}
          >
            <X size={16} />
          </Button>
        </div>
      ))}
    </div>
  );
}
