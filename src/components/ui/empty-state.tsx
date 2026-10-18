import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * El estado vacío de Diario: un título en display, una frase en la voz
 * (Literata en cursiva) y, si hay algo que hacer, una acción. Sin
 * ilustración: una página en blanco es una invitación a escribir. Va en la
 * columna de texto; quien lo monta dentro de una página con margen lo sangra
 * con `pl-(--margen)` o lo mete en una MarginRow.
 */
function EmptyState({
  title,
  description,
  action,
  className,
  ...props
}: Omit<React.ComponentProps<"section">, "title"> & {
  title: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <section
      data-slot="empty-state"
      className={cn("flex flex-col items-start gap-2 py-6", className)}
      {...props}
    >
      <h2 className="font-display text-xl leading-tight font-bold tracking-tight text-foreground">
        {title}
      </h2>
      {description && (
        <p className="font-voice text-base italic leading-snug text-body">{description}</p>
      )}
      {action && (
        <div data-slot="empty-state-action" className="mt-2">
          {action}
        </div>
      )}
    </section>
  )
}

export { EmptyState }
