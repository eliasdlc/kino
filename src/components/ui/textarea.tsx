import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        // El área es superficie (1.125rem), no pastilla: varias líneas de
        // texto no caben en un pill.
        "flex field-sizing-content min-h-20 w-full rounded-xl border border-input bg-transparent px-4 py-3 text-base transition-colors focus-ring placeholder:text-muted-foreground focus-visible:border-ring disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
