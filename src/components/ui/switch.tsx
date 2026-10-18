"use client"

import * as React from "react"
import { Switch as SwitchPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

function Switch({
  className,
  size = "default",
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root> & {
  size?: "sm" | "default"
}) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      className={cn(
        // El dibujo mide 1.25 x 2.15rem; la zona de toque, con el ::after,
        // llega a 2.85rem de alto sin agrandar el interruptor.
        "peer group/switch relative inline-flex shrink-0 items-center rounded-full border border-transparent transition-[color,background-color,border-color] duration-(--dur-toque) focus-ring after:absolute after:-inset-x-3 after:-inset-y-[0.8rem] aria-invalid:border-destructive data-[size=default]:h-[1.25rem] data-[size=default]:w-[2.15rem] data-[size=sm]:h-[.9rem] data-[size=sm]:w-[1.5rem] data-checked:bg-primary data-unchecked:bg-secondary data-disabled:cursor-not-allowed data-disabled:opacity-50",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="pointer-events-none block rounded-full bg-background ring-0 transition-transform duration-(--dur-toque) ease-(--ease-pluma) group-data-[size=default]/switch:size-4 group-data-[size=sm]/switch:size-3 group-data-[size=default]/switch:data-checked:translate-x-[calc(100%-2px)] group-data-[size=sm]/switch:data-checked:translate-x-[calc(100%-2px)]  group-data-[size=default]/switch:data-unchecked:translate-x-0 group-data-[size=sm]/switch:data-unchecked:translate-x-0"
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
