/**
 * El encabezado de una sección de las pantallas de escritura (estudio, tablero,
 * hilos, cronología): el título en Bricolage, a la derecha la cifra o la acción
 * en `--mute`, y un hairline debajo. Es como Diario agrupa: un título y una
 * línea, nunca una caja. El mismo dibujo que el encabezado de sección de Hoy.
 */
export function WritingSectionHead({
  title,
  meta,
  as: Tag = "h2",
  id,
}: {
  title: React.ReactNode;
  meta?: React.ReactNode;
  as?: "h2" | "h3";
  id?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border pb-2">
      <Tag id={id} className="min-w-0 font-display text-[1.18rem] leading-tight font-bold tracking-[-0.02em] text-foreground">
        {title}
      </Tag>
      {meta !== undefined && meta !== null && (
        <span className="shrink-0 text-sm text-muted-foreground tabular-nums">{meta}</span>
      )}
    </div>
  );
}
