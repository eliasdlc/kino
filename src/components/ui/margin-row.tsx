import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * La fila de margen, la firma de Diario. Tres columnas: el margen de la casa
 * (`--margen`, 3.1rem), donde viven el glifo, el numeral o el círculo de
 * completar; el texto, que nunca entra en el margen; y una cola automática
 * para la cifra, el valor o el chevron. Las filas se separan con un hairline
 * y la última no lo lleva. Un bloque que no es fila (la cota, un párrafo) se
 * alinea con la columna de texto usando `pl-(--margen)`.
 *
 * Tocable: con `href` la fila entera es un enlace, con `onClick` un botón;
 * las dos llevan el foco único y el toque de la casa. Sin ninguno es un div,
 * y entonces lo tocable va dentro (el círculo de completar).
 *
 * Cuándo usar: toda lista del teléfono (tareas, índice, ajustes). Card queda
 * para el escritorio y el shell, nunca para agrupar una lista en móvil.
 */
function MarginRow({
  margin,
  trailing,
  href,
  onClick,
  className,
  children,
  ...props
}: Omit<React.ComponentProps<"div">, "onClick"> & {
  /** Lo que va en el margen: un glifo, un numeral, un círculo. */
  margin: React.ReactNode
  /** Lo que va a la derecha: una cifra, un valor, un chevron. */
  trailing?: React.ReactNode
  /** Destino: la fila entera es un enlace. */
  href?: string
  /** Acción: la fila entera es un botón. */
  onClick?: React.MouseEventHandler<HTMLElement>
}) {
  const tocable = Boolean(href || onClick)
  const Comp = (href ? "a" : onClick ? "button" : "div") as "div"
  return (
    <Comp
      data-slot="margin-row"
      {...(href ? { href } : {})}
      {...(onClick && !href ? { type: "button" } : {})}
      onClick={onClick}
      className={cn(
        "grid min-h-[3.4rem] w-full grid-cols-[var(--margen)_1fr_auto] items-center border-b border-border text-left last:border-b-0",
        tocable &&
          "press cursor-pointer transition-[background-color,transform] duration-(--dur-toque) ease-(--ease-pluma) focus-ring hover:bg-sf2/60",
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
    </Comp>
  )
}

export { MarginRow }
