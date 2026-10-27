"use client";

import { cn } from "@/lib/utils";
import { TASK_TYPE_VALUES } from "@/shared/types/enums";
import type { TaskTypeValue } from "@/shared/types/enums";
import { getTaskTypeConfig } from "./task-type-config";

interface TaskTypePickerProps {
  value: TaskTypeValue | null | undefined;
  metadata?: Record<string, unknown> | null;
  systemTemplateType?: string;
  onChange: (value: TaskTypeValue | undefined, subtype?: string) => void;
}

/**
 * El tipo de una tarea, en fichas de 48 px en el teléfono. La elegida va en
 * tinta, como un segmento: elegir un tipo es un estado, no una acción.
 */
export function TaskTypePicker({ value, metadata, systemTemplateType, onChange }: TaskTypePickerProps) {
  const generalOptions: Array<{ type: TaskTypeValue; subtype?: string }> = TASK_TYPE_VALUES.map((t) => ({ type: t }));
  const academicOptions: Array<{ type: TaskTypeValue; subtype?: string }> = [];

  if (systemTemplateType === 'academic') {
    academicOptions.push(
      { type: 'event', subtype: 'exam' },
      { type: 'event', subtype: 'quiz' },
      { type: 'event', subtype: 'practice' }
    );
  }

  const renderOption = (opt: { type: TaskTypeValue; subtype?: string }) => {
    const config = getTaskTypeConfig(opt.type, opt.subtype ? { eventSubtype: opt.subtype } : null);
    const Icon = config.icon;
    const isSelected = value === opt.type && metadata?.eventSubtype === opt.subtype;
    return (
      <button
        key={`${opt.type}-${opt.subtype ?? 'base'}`}
        type="button"
        onClick={() => onChange(isSelected ? undefined : opt.type, isSelected ? undefined : opt.subtype)}
        aria-pressed={isSelected}
        className={cn(
          "press focus-ring inline-flex h-[2.85rem] items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-[color,background-color,border-color,transform] duration-(--dur-toque) ease-(--ease-pluma) md:pointer-fine:h-8 md:pointer-fine:px-3 md:pointer-fine:text-xs",
          isSelected
            ? "border-foreground bg-foreground text-background"
            : "border-border bg-transparent text-muted-foreground hover:border-foreground/40 hover:text-foreground"
        )}
      >
        <Icon className="size-3.5" />
        {config.label}
      </button>
    );
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <div className="text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">Generales</div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {generalOptions.map(renderOption)}
        </div>
      </div>
      {academicOptions.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">Eventos académicos</div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {academicOptions.map(renderOption)}
          </div>
        </div>
      )}
    </div>
  );
}
