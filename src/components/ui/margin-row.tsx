import * as React from "react"
import Link from "next/link"

import { cn } from "@/lib/utils"

/**
 * La fila de margen, la firma de Diario. Tres columnas: el margen de la casa
 * (`--margen`, 3.1rem), donde viven el glifo, el numeral o el círculo de
 * completar; el texto, que nunca entra en el margen; y una cola automática
 * para la cifra, el valor o el chevron. Las filas se separan con un hairline
 * y la última no lo lleva. Un bloque que no es fila (la cota, un párrafo) se
 * alinea con la columna de texto usando `pl-(--margen)`.
 *
 * Tocable: con `href` la fila entera es un enlace (next/link), con `onClick`
 * un botón; las dos llevan el foco único y el toque de la casa. Sin ninguno
 * es un div, y entonces lo tocable va dentro (el círculo de completar). Las
 * tres columnas son spans para que la fila sea HTML válido también dentro
 * del botón: el contenido de una fila tocable va en spans, no en párrafos.
 *
 * Cuándo usar: toda lista del teléfono (tareas, índice, ajustes). Card queda
 * para el escritorio y el shell, nunca para agrupar una lista en móvil.
 */
type MarginRowProps = {
  /** Lo que va en el margen: un glifo, un numeral, un círculo. */
  margin: React.ReactNode
  /** Lo que va a la derecha: una cifra, un valor, un chevron. */
  trailing?: React.ReactNode
  /** Destino: la fila entera es un enlace. */
  href?: string
  /** Acción: la fila entera es un botón. */
  onClick?: React.MouseEventHandler<HTMLElement>
  className?: string
  children?: React.ReactNode
} & Omit<React.HTMLAttributes<HTMLElement>, "onClick" | "className" | "children">

function MarginRow({ margin, trailing, href, onClick, className, children, ...props }: MarginRowProps) {
  const tocable = Boolean(href || onClick)
  const clase = cn(
    "grid min-h-[3.4rem] w-full grid-cols-[var(--margen)_1fr_auto] items-center border-b border-border text-left last:border-b-0",
    tocable &&
      "press cursor-pointer transition-[background-color,transform] duration-(--dur-toque) ease-(--ease-pluma) focus-ring hover:bg-sf2/60",
    className
  )
  const contenido = (
    <>
      <span data-slot="margin-row-margin" className="flex justify-center self-start pt-[0.15rem] text-muted-foreground">
        {margin}
      </span>
      <span data-slot="margin-row-text" className="block min-w-0 py-2">
        {children}
      </span>
      {trailing !== undefined && trailing !== null && (
        <span data-slot="margin-row-trailing" className="block pl-2.5 text-right text-sm whitespace-nowrap text-muted-foreground tabular-nums">
          {trailing}
        </span>
      )}
    </>
  )
  if (href) {
    return (
      <Link data-slot="margin-row" href={href} onClick={onClick} className={clase} {...props}>
        {contenido}
      </Link>
    )
  }
  if (onClick) {
    return (
      <button data-slot="margin-row" type="button" onClick={onClick} className={clase} {...props}>
        {contenido}
      </button>
    )
  }
  return (
    <div data-slot="margin-row" className={clase} {...props}>
      {contenido}
    </div>
  )
}

export { MarginRow }
