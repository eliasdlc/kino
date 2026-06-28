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
        className={cn(
          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all border",
          isSelected
            ? cn(config.pillClass, "border-transparent ring-2 ring-offset-1 ring-current/30")
            : "bg-transparent border-border text-muted-foreground hover:border-muted-foreground/50"
        )}
      >
        <Icon size={12} className={isSelected ? config.iconClass : undefined} />
        {config.label}
      </button>
    );
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <div className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">Generales</div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {generalOptions.map(renderOption)}
        </div>
      </div>
      {academicOptions.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">Eventos Académicos</div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {academicOptions.map(renderOption)}
          </div>
        </div>
      )}
    </div>
  );
}
