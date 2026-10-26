"use client"

import * as React from "react"
import { ToggleGroup as ToggleGroupPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

export interface SegmentedOption<T extends string> {
  value: T
  label: React.ReactNode
}

const SIGUIENTE: Record<string, 1 | -1> = {
  ArrowRight: 1,
  ArrowDown: 1,
  ArrowLeft: -1,
  ArrowUp: -1,
}

/**
 * El segmento de Diario: de dos a cuatro opciones sobre sf2, la elegida en
 * tinta. Es un grupo de radios: una opción activa siempre, y las flechas
 * eligen la siguiente (Radix mueve el foco; aquí también se elige, como en un
 * radiogroup de verdad). Cada opción mide 2.85rem. El acento no entra: elegir
 * un tema o una vista es un estado, no una acción, y el estado se dice en
 * tinta.
 *
 * Cuándo usar: para elegir un valor entre dos y cuatro (tema, tramo, Lista o
 * Calendario) sin cambiar de pantalla. Para moverse entre secciones de una
 * misma pantalla, Tabs.
 */
function Segmented<T extends string>({
  value,
  onValueChange,
  options,
  className,
  onKeyDown,
  ...props
}: Omit<React.ComponentProps<"div">, "onChange" | "value" | "defaultValue" | "dir"> & {
  value: T
  onValueChange: (value: T) => void
  options: ReadonlyArray<SegmentedOption<T>>
}) {
  const elegirConFlecha = (event: React.KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(event)
    const paso = SIGUIENTE[event.key]
    const actual = options.findIndex((o) => o.value === value)
    if (!paso || actual < 0) return
    const siguiente = options[(actual + paso + options.length) % options.length]
    onValueChange(siguiente.value)
  }

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
      onKeyDown={elegirConFlecha}
      className={cn(
        "inline-flex w-fit items-center gap-0.5 rounded-full bg-secondary p-1 text-sm font-semibold",
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
          className="press inline-flex h-[2.85rem] min-w-[3.6rem] items-center justify-center rounded-full px-3 whitespace-nowrap text-muted-foreground transition-[color,background-color,transform] duration-(--dur-toque) ease-(--ease-pluma) focus-ring data-on:bg-foreground data-on:text-background disabled:pointer-events-none disabled:opacity-50"
        >
          {option.label}
        </ToggleGroupPrimitive.Item>
      ))}
    </ToggleGroupPrimitive.Root>
  )
}

export { Segmented }
