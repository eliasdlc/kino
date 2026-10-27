import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        // El campo es una pastilla de la altura del botón, con el hairline
        // fuerte de un objetivo seleccionable y el foco único de la casa.
        "h-[2.85rem] w-full min-w-0 rounded-full border border-input bg-transparent px-4 py-2 text-base transition-colors focus-ring file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive",
        className
      )}
      {...props}
    />
  )
}

export { Input }
