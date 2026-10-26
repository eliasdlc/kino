import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  // Un toque encoge la pastilla a .97 (press) en --dur-toque con pluma; el
  // foco es el anillo único de la casa (focus-ring). Transiciona color y
  // transform, nunca la sombra: el glow de la primaria no cambia.
  "group/button press inline-flex shrink-0 items-center justify-center rounded-full border border-transparent bg-clip-padding text-sm font-semibold whitespace-nowrap transition-[color,background-color,border-color,transform] duration-(--dur-toque) ease-(--ease-pluma) select-none focus-ring disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-5",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-[0_.5em_1.4em_-.4em_var(--glow)] hover:bg-primary/90",
        outline:
          "border-input bg-transparent hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80 aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
        ghost:
          "hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        // Alturas en rem: crecen con el tamaño de letra del sistema. La acción
        // primaria (lg) mide 3.2rem; el táctil mínimo lo da default a 2.85rem.
        // xs y sm existen para el escritorio: en el teléfono miden el táctil
        // y sólo encogen desde md con puntero fino (ratón o trackpad). Una
        // tableta táctil pasa de 768 px y sigue tocándose con el dedo, así que
        // con puntero grueso se quedan en 2.85rem a cualquier ancho.
        default:
          "h-[2.85rem] gap-2 px-4 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
        xs: "h-[2.85rem] gap-1.5 px-3 text-xs md:pointer-fine:h-8 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 [&_svg:not([class*='size-'])]:size-3.5",
        sm: "h-[2.85rem] gap-1.5 px-3.5 md:pointer-fine:h-10 has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5",
        lg: "h-[3.2rem] gap-2 px-[1.1rem] has-data-[icon=inline-end]:pr-3.5 has-data-[icon=inline-start]:pl-3.5",
        icon: "size-[2.85rem]",
        "icon-xs":
          "size-[2.85rem] md:pointer-fine:size-8 [&_svg:not([class*='size-'])]:size-3.5",
        "icon-sm":
          "size-[2.85rem] md:pointer-fine:size-10",
        "icon-lg": "size-[3.2rem]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
