"use client";

import { cn } from "@/lib/utils";
import { TASK_TYPE_VALUES } from "@/shared/types/enums";
import type { TaskTypeValue } from "@/shared/types/enums";
import { getTaskTypeConfig } from "./task-type-config";

interface TaskTypePickerProps {
  value: TaskTypeValue | null | undefined;
  onChange: (value: TaskTypeValue | undefined) => void;
}

export function TaskTypePicker({ value, onChange }: TaskTypePickerProps) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {TASK_TYPE_VALUES.map((type) => {
        const config = getTaskTypeConfig(type);
        const Icon = config.icon;
        const isSelected = value === type;
        return (
          <button
            key={type}
            type="button"
            onClick={() => onChange(isSelected ? undefined : type)}
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
      })}
    </div>
  );
}
