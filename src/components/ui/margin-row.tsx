import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * La fila de margen, la firma de Diario. Tres columnas: el margen de la casa
 * (`--margen`, 3.1rem), donde viven el glifo, el numeral o el círculo de
 * completar; el texto, que nunca entra en el margen; y una cola automática
 * para la cifra, el valor o el chevron. Las filas se separan con un hairline
 * y la última no lo lleva. Un bloque que no es fila (la cota, un párrafo) se
 * alinea con la columna de texto usando `pl-(--margen)`.
 */
function MarginRow({
  margin,
  trailing,
  className,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  /** Lo que va en el margen: un glifo, un numeral, un círculo. */
  margin: React.ReactNode
  /** Lo que va a la derecha: una cifra, un valor, un chevron. */
  trailing?: React.ReactNode
}) {
  return (
    <div
      data-slot="margin-row"
      className={cn(
        "grid min-h-[3.4rem] grid-cols-[var(--margen)_1fr_auto] items-center border-b border-border last:border-b-0",
        className
      )}
      {...props}
    >
      <div data-slot="margin-row-margin" className="flex justify-center self-start pt-[0.15rem] text-muted-foreground">
        {margin}
      </div>
      <div data-slot="margin-row-text" className="min-w-0 py-2">
        {children}
      </div>
      {trailing !== undefined && trailing !== null && (
        <div data-slot="margin-row-trailing" className="pl-2.5 text-right text-sm whitespace-nowrap text-muted-foreground tabular-nums">
          {trailing}
        </div>
      )}
    </div>
  )
}

export { MarginRow }
