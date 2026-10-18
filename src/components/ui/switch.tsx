"use client"

import * as React from "react"
import { Switch as SwitchPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

/**
 * El interruptor: encendido es el acento, apagado es superficie. El dibujo
 * mide 1.25 x 2.15rem y la zona de toque, con el ::after, llega a 2.85rem de
 * alto sin agrandarlo. Un solo tamaño: el pequeño quedaba bajo el táctil y
 * nadie lo usaba. El pulgar lleva hairline fuerte para leerse apagado sobre
 * la pista.
 */
function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer group/switch relative inline-flex h-[1.25rem] w-[2.15rem] shrink-0 items-center rounded-full border border-transparent transition-[color,background-color,border-color] duration-(--dur-toque) ease-(--ease-pluma) focus-ring after:absolute after:-inset-x-3 after:-inset-y-[0.8rem] aria-invalid:border-destructive data-checked:bg-primary data-unchecked:bg-secondary data-disabled:cursor-not-allowed data-disabled:opacity-50",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="pointer-events-none block size-4 rounded-full border border-ln2 bg-background transition-transform duration-(--dur-toque) ease-(--ease-pluma) data-checked:translate-x-[calc(100%-2px)] data-unchecked:translate-x-0"
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
