/**
 * El glifo del margen de una fila de una sola línea. `MarginRow` pega el margen
 * arriba (para que en una fila de dos líneas el glifo acompañe a la primera),
 * así que en una fila de una línea el glifo quedaba por encima del texto. Con
 * `UNA_LINEA` el margen se centra en la fila como el texto y la cola, y glifo,
 * texto y valor comparten eje.
 */
export const UNA_LINEA =
  "[&>[data-slot=margin-row-margin]]:self-center [&>[data-slot=margin-row-margin]]:pt-0";

export function MargenDeUnaLinea({ children }: { children: React.ReactNode }) {
  return <span className="flex items-center">{children}</span>;
}
