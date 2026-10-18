import { cn } from "@/lib/utils";

/**
 * El título de una sección del índice: la palabra en Bricolage, a la derecha
 * la cuenta en mute o la acción de esa sección ("Nueva obra"), y un hairline
 * fuerte debajo que separa sin encerrar. Es la misma regla que el título de
 * sección de Hoy, con sitio para una acción, que Hoy no necesita.
 */
export function IndexHead({
  title,
  trailing,
  as: Tag = "h2",
  id,
  className,
}: {
  title: React.ReactNode;
  /** Una cuenta ("1 manuscrito") o una acción con nombre. */
  trailing?: React.ReactNode;
  as?: "h2" | "h3";
  /** Para que la sección lo nombre con `aria-labelledby`. */
  id?: string;
  className?: string;
}) {
  return (
    <div
      data-slot="index-head"
      className={cn("flex min-h-[2.85rem] flex-wrap items-end justify-between gap-x-3 border-b border-input pb-[0.45rem]", className)}
    >
      <Tag id={id} className="font-display text-[1.25rem] leading-[1.15] font-bold tracking-[-0.02em]">
        {title}
      </Tag>
      {trailing !== undefined && trailing !== null && trailing !== false && (
        <div className="-mb-2 ml-auto flex shrink-0 items-center text-[0.84rem] text-muted-foreground tabular-nums">{trailing}</div>
      )}
    </div>
  );
}
