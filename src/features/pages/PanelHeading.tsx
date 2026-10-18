/**
 * El encabezado de un bloque del panel del editor: la eyebrow de la casa
 * (Figtree 600, mayúsculas, +0.06em) y un hairline debajo. Agrupa sin caja.
 */
export function PanelHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="border-b border-border pb-2 text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
      {children}
    </h3>
  );
}
