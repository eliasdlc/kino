"use client";

import * as React from "react";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface TimePickerProps {
  value?: string;
  onChange?: (value: string) => void;
  className?: string;
  placeholder?: string;
  id?: string;
  disabled?: boolean;
}

const TIME_OPTIONS = Array.from({ length: 24 * 4 }).map((_, i) => {
  const hour = Math.floor(i / 4);
  const minute = (i % 4) * 15;
  const hourStr = hour.toString().padStart(2, "0");
  const minuteStr = minute.toString().padStart(2, "0");
  const val = `${hourStr}:${minuteStr}`;
  // generate keywords for cmdk filtering
  // allow "830", "0830", "8:30", "08:30"
  const keywords = [
    `${hour}${minuteStr}`,
    `${hourStr}${minuteStr}`,
    `${hour}:${minuteStr}`,
    `${hourStr}:${minuteStr}`,
  ];
  return { value: val, label: val, keywords };
});

export function TimePicker({ value, onChange, className, placeholder = "Elegir hora", id, disabled }: TimePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [inputValue, setInputValue] = React.useState("");

  // Parse raw input if user presses enter and no exact item matched,
  // or just rely on cmdk's first filtered item.
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && inputValue) {
      // Try to parse "830" -> "08:30"
      const match = inputValue.match(/^(\d{1,2}):?(\d{2})?$/);
      if (match) {
        const h = parseInt(match[1], 10);
        const m = parseInt(match[2] || "0", 10);
        if (h >= 0 && h < 24 && m >= 0 && m < 60) {
          const hh = h.toString().padStart(2, "0");
          const mm = m.toString().padStart(2, "0");
          onChange?.(`${hh}:${mm}`);
          setOpen(false);
        }
      }
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          disabled={disabled}
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-start text-left font-normal",
            !value && "text-muted-foreground",
            className
          )}
        >
          <Clock className="mr-2 h-4 w-4 shrink-0 opacity-50" />
          {value || placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0" align="start">
        <Command onKeyDown={handleKeyDown}>
          <CommandInput
            placeholder="Ej. 08:30 o 830..."
            value={inputValue}
            onValueChange={setInputValue}
          />
          <CommandList>
            <CommandEmpty>No se encontró la hora.</CommandEmpty>
            <CommandGroup>
              {TIME_OPTIONS.map((time) => (
                <CommandItem
                  key={time.value}
                  value={time.value}
                  keywords={time.keywords}
                  onSelect={(currentValue) => {
                    onChange?.(currentValue);
                    setOpen(false);
                  }}
                >
                  <Clock className="mr-2 h-4 w-4 opacity-50" />
                  {time.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
