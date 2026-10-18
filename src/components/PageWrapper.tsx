import { cn } from "@/lib/utils";

type PageWrapperProps = React.HTMLAttributes<HTMLDivElement>;

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  /** Lo que va en el margen junto al título: el glifo del arquetipo, un numeral. */
  margin?: React.ReactNode;
}

/**
 * El título de pantalla de Diario. En el teléfono el título va en la columna
 * de texto, a la derecha del margen (`--margen`), y el margen lleva el glifo
 * si lo hay; la descripción es la voz, Literata en cursiva. En escritorio el
 * margen se pliega: el sidebar ya es la columna de la izquierda.
 */
export function PageHeader({ title, description, actions, margin }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="grid min-w-0 grid-cols-[var(--margen)_1fr] md:grid-cols-[0_1fr]">
        <span data-slot="page-header-margin" className="flex justify-center self-start pt-1 text-muted-foreground md:hidden">
          {margin}
        </span>
        <div className="min-w-0 space-y-1">
          <h1 className="font-display text-[1.41rem] font-bold tracking-[-0.02em]">{title}</h1>
          {description && (
            <p className="font-voice text-base italic leading-snug text-body">{description}</p>
          )}
        </div>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2 max-sm:pl-(--margen)">{actions}</div>}
    </div>
  );
}

/**
 * La página de Diario: el papel con su canto (1.25rem en el teléfono, 2rem
 * desde md) más el área segura de los lados, y 1.25rem entre bloques. El
 * margen de la casa (`--margen`, 3.1rem) no se aplica aquí a todo el
 * contenido, porque una fila (`MarginRow`) lo lleva dentro de su rejilla:
 * aquí lo usan los bloques que no son fila (`pl-(--margen)`) y una página
 * que no lo quiera lo pliega con `[--margen:0]`.
 */
export function PageWrapper({ children, className, ...props }: PageWrapperProps) {
  return (
    <div
      {...props}
      data-slot="page"
      className={cn(
        "w-full space-y-5 py-5 pl-[max(1.25rem,env(safe-area-inset-left))] pr-[max(1.25rem,env(safe-area-inset-right))] md:px-8 md:py-6",
        className,
      )}
    >
      {children}
    </div>
  );
}
