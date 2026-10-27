import { cn } from '@/lib/utils';

/**
 * El título de sección de Diario: la palabra en Bricolage a la izquierda, la
 * cuenta en mute y tabular a la derecha, y un hairline fuerte debajo que
 * separa sin encerrar. Es lo que sustituye a la card en Hoy: una página tiene
 * encabezados y renglones, no cajas.
 */
export function SectionHead({
  title,
  count,
  as: Tag = 'h2',
  id,
  className,
}: {
  title: string;
  count?: React.ReactNode;
  as?: 'h2' | 'h3';
  /** Para que la sección que encabeza lo nombre con `aria-labelledby`. */
  id?: string;
  className?: string;
}) {
  return (
    <div className={cn('flex items-baseline justify-between gap-3 border-b border-input pb-[0.45rem]', className)}>
      <Tag id={id} className="font-display text-[1.25rem] leading-[1.15] font-bold tracking-[-0.02em]">{title}</Tag>
      {count !== undefined && count !== null && count !== '' && (
        <span className="shrink-0 text-[0.84rem] text-muted-foreground tabular-nums">{count}</span>
      )}
    </div>
  );
}
