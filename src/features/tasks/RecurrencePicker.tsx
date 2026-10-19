"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Fichas } from "./Fichas";
import { RECURRENCE_PRESETS, isValidRRule } from "./recurrence";

const PRESET_VALUES: string[] = [
  RECURRENCE_PRESETS.daily,
  RECURRENCE_PRESETS.weekly,
  RECURRENCE_PRESETS.monthly,
];

const OPTIONS = [
  { value: "none", label: "No se repite" },
  { value: RECURRENCE_PRESETS.daily, label: "Cada día" },
  { value: RECURRENCE_PRESETS.weekly, label: "Cada semana" },
  { value: RECURRENCE_PRESETS.monthly, label: "Cada mes" },
  { value: "custom", label: "Otra regla" },
];

interface RecurrencePickerProps {
  value: string | null | undefined;
  onChange: (value: string | null) => void;
  /** Id del rótulo que nombra el grupo (el margen del detalle); sin él, el grupo se llama "Repetición". */
  labelledBy?: string;
}

/**
 * La repetición en fichas de 48 px, la elegida en tinta: cinco opciones caben
 * de un vistazo y un `Select` de escritorio no es un gesto del pulgar. "Otra
 * regla" abre el campo de la regla RRULE.
 */

export function RecurrencePicker({ value, onChange, labelledBy }: RecurrencePickerProps) {
  // "custom" cuando hay una regla que no es preset. El estado local recuerda que
  // la persona eligió "Otra regla" aunque el input esté momentáneamente vacío.
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
      <Fichas label="Repetición" labelledBy={labelledBy} options={OPTIONS} selected={[showCustom ? "custom" : selectValue]} onToggle={handleSelect} />

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
