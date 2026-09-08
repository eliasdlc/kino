/**
 * Criterio: el manifiesto sale de la misma lista que arma el export, no de un
 * array escrito al lado que se queda viejo. Una fila por tabla del schema, con
 * si viaja y en qué formato, y un motivo escrito para cada una que no viaja.
 */
import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { EXPORT_TABLES } from "./export-manifest";
import { ExportManifestTable } from "./ExportManifestTable";

describe("ExportManifestTable", () => {
  it("pinta una fila por tabla del manifiesto, ni una más", () => {
    render(<ExportManifestTable />);

    const filas = within(screen.getByRole("table")).getAllByRole("row");
    expect(filas).toHaveLength(EXPORT_TABLES.length + 1);
  });

  it("cada tabla dice su formato, y la que no viaja dice por qué", () => {
    render(<ExportManifestTable />);

    // Por posición y no por nombre: dos etiquetas comparten palabra («Tareas»
    // y «Tareas enlazadas a capítulos») y el orden de la lista es el contrato.
    const filas = within(screen.getByRole("table")).getAllByRole("row").slice(1);
    EXPORT_TABLES.forEach(({ etiqueta, formato, motivo }, i) => {
      const fila = filas[i]!;
      expect(within(fila).getByRole("rowheader")).toHaveTextContent(etiqueta);
      expect(within(fila).getByText(formato ?? motivo!)).toBeVisible();
      expect(within(fila).getByText(formato === null ? "No" : "Sí")).toBeVisible();
    });
  });

  it("dice cuántas de cuántas viajan, con las dos cifras de la misma lista", () => {
    render(<ExportManifestTable />);

    const viajan = EXPORT_TABLES.filter((t) => t.formato !== null).length;
    expect(screen.getByText(new RegExp(`${viajan} de ${EXPORT_TABLES.length} tablas`))).toBeVisible();
  });
});
