"use client";

import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { RECURRENCE_PRESETS, isValidRRule } from "./recurrence";

const PRESET_VALUES: string[] = [
  RECURRENCE_PRESETS.daily,
  RECURRENCE_PRESETS.weekly,
  RECURRENCE_PRESETS.monthly,
];

const OPTIONS = [
  { value: "none", label: "Sin repetición" },
  { value: RECURRENCE_PRESETS.daily, label: "Diariamente" },
  { value: RECURRENCE_PRESETS.weekly, label: "Semanalmente" },
  { value: RECURRENCE_PRESETS.monthly, label: "Mensualmente" },
  { value: "custom", label: "Personalizar…" },
];

interface RecurrencePickerProps {
  value: string | null | undefined;
  onChange: (value: string | null) => void;
}

export function RecurrencePicker({ value, onChange }: RecurrencePickerProps) {
  // "custom" cuando hay una regla que no es preset. El estado local recuerda que
  // el usuario eligió "Personalizar…" aunque el input esté momentáneamente vacío.
  const isPresetValue = !!value && PRESET_VALUES.includes(value);
  const [customMode, setCustomMode] = useState(!!value && !isPresetValue);

  const selectValue = !value ? "none" : isPresetValue ? value : "custom";
  const showCustom = customMode || (!!value && !isPresetValue);
  const customInvalid = showCustom && !!value && !isValidRRule(value);

  function handleSelect(next: string) {
    if (next === "none") {
      setCustomMode(false);
      onChange(null);
    } else if (next === "custom") {
      setCustomMode(true);
      // No emitimos regla hasta que el usuario escriba una válida.
      onChange(null);
    } else {
      setCustomMode(false);
      onChange(next);
    }
  }

  return (
    <div className="space-y-2">
      <Select value={selectValue} onValueChange={handleSelect}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {showCustom && (
        <div className="space-y-1">
          <Input
            placeholder="FREQ=WEEKLY;BYDAY=MO,WE,FR"
            value={value ?? ""}
            onChange={(e) => {
              const text = e.target.value.trim();
              onChange(text.length > 0 ? text : null);
            }}
            aria-invalid={customInvalid}
          />
          {customInvalid && (
            <p className="text-xs text-destructive">Regla de recurrencia inválida</p>
          )}
        </div>
      )}
    </div>
  );
}
