/**
 * El glifo del margen de una fila de una sola línea. `MarginRow` pega el margen
 * arriba (para que en una fila de dos líneas el glifo acompañe a la primera),
 * así que en una fila de una línea el glifo quedaba por encima del texto. Con
 * la fila en `items-start` (`UNA_LINEA`) y el glifo centrado en el alto de esa
 * línea, glifo y texto comparten eje.
 */
export const UNA_LINEA = "items-start";

export function MargenDeUnaLinea({ children }: { children: React.ReactNode }) {
  return <span className="flex h-[2.15rem] items-center">{children}</span>;
}
