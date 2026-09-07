'use client';

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";

const PRESETS = [
  { label: '15m', value: 15 },
  { label: '30m', value: 30 },
  { label: '1h', value: 60 },
  { label: '2h', value: 120 },
] as const;

const EXTENDED_PRESETS = [
  { label: '3h', value: 180 },
  { label: '4h', value: 240 },
  { label: '5h', value: 300 },
] as const;

interface EstimatedTimePickerProps {
  value: number | null | undefined;
  onChange: (value: number | null) => void;
}

export function EstimatedTimePicker({ value, onChange }: EstimatedTimePickerProps) {
  const [customOpen, setCustomOpen] = useState(false);
  const [customInput, setCustomInput] = useState('');

  const isExtended = value != null && value > 120;
  const isCustom = value != null && ![15, 30, 60, 120, 180, 240, 300].includes(value);

  function handleCustomSubmit() {
    const mins = parseInt(customInput, 10);
    if (!isNaN(mins) && mins > 0) {
      onChange(mins);
      setCustomOpen(false);
      setCustomInput('');
    }
  }

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {PRESETS.map((p) => (
        <button
          key={p.value}
          type="button"
          onClick={() => onChange(value === p.value ? null : p.value)}
          className={cn(
            "px-2.5 py-1 rounded-md text-xs font-medium border transition-colors",
            value === p.value
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-transparent border-border text-muted-foreground hover:border-muted-foreground/50"
          )}
        >
          {p.label}
        </button>
      ))}

      <Popover open={customOpen} onOpenChange={setCustomOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "px-2.5 py-1 rounded-md text-xs font-medium border transition-colors",
              (isExtended || isCustom)
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-transparent border-border text-muted-foreground hover:border-muted-foreground/50"
            )}
          >
            {isExtended && !isCustom
              ? `${Math.floor(value! / 60)}h`
              : isCustom
              ? `${value}m`
              : '3h+'}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-48 p-3" align="start">
          <div className="flex flex-col gap-2">
            {EXTENDED_PRESETS.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => { onChange(p.value); setCustomOpen(false); }}
                className={cn(
                  "px-2.5 py-1.5 rounded-md text-sm text-left transition-colors",
                  value === p.value ? "bg-primary text-primary-foreground" : "hover:bg-accent"
                )}
              >
                {p.label}
              </button>
            ))}
            <div className="flex gap-1.5 mt-1 border-t pt-2">
              <Input
                type="number"
                placeholder="min"
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCustomSubmit()}
                className="h-7 text-xs"
                min={1}
              />
              <Button size="sm" className="h-7 px-2 text-xs" onClick={handleCustomSubmit}>OK</Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {value != null && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="px-2.5 py-1 rounded-md text-xs font-medium border border-border text-muted-foreground hover:border-muted-foreground/50 transition-colors"
        >
          Sin estimar
        </button>
      )}
    </div>
  );
}

/** Converts minutes to HH:MM:SS for the DB time column. */
export function minutesToTimeString(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
}
