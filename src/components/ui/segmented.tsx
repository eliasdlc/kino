"use client"

import * as React from "react"
import { ToggleGroup as ToggleGroupPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

export interface SegmentedOption<T extends string> {
  value: T
  label: React.ReactNode
}

/**
 * El segmento de Diario: de dos a cuatro opciones sobre sf2, la elegida en
 * tinta. Es un grupo de radios (una opción activa siempre, flechas para
 * moverse) y mide 2.85rem. El acento no entra: elegir un tema o una vista no
 * es una acción, es un estado, y en Diario el estado se dice en tinta.
 */
function Segmented<T extends string>({
  value,
  onValueChange,
  options,
  className,
  ...props
}: Omit<React.ComponentProps<"div">, "onChange" | "value" | "defaultValue" | "dir"> & {
  value: T
  onValueChange: (value: T) => void
  options: ReadonlyArray<SegmentedOption<T>>
}) {
  return (
    <ToggleGroupPrimitive.Root
      type="single"
      data-slot="segmented"
      role="radiogroup"
      value={value}
      onValueChange={(next) => {
        // Radix emite "" al tocar la opción ya elegida; un radio no se desmarca.
        if (next) onValueChange(next as T)
      }}
      className={cn(
        "inline-flex h-[2.85rem] w-fit items-center gap-0.5 rounded-full bg-secondary p-1 text-sm font-semibold",
        className
      )}
      {...props}
    >
      {options.map((option) => (
        <ToggleGroupPrimitive.Item
          key={option.value}
          data-slot="segmented-option"
          data-on={option.value === value ? "" : undefined}
          value={option.value}
          className="press inline-flex h-full min-w-[3.6rem] items-center justify-center rounded-full px-3 whitespace-nowrap text-muted-foreground transition-[color,background-color] duration-(--dur-toque) focus-ring data-on:bg-foreground data-on:text-background disabled:pointer-events-none disabled:opacity-50"
        >
          {option.label}
        </ToggleGroupPrimitive.Item>
      ))}
    </ToggleGroupPrimitive.Root>
  )
}

export { Segmented }
