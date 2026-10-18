/**
 * Criterio: la fila de margen es la firma de Diario. Una columna de 3.1rem a
 * la izquierda (`--margen`) donde viven el glifo, el numeral o el círculo; el
 * texto nunca entra en el margen, y lo que va a la derecha (cifra, valor,
 * chevron) es una tercera columna automática. Las filas se separan con un
 * hairline y la última no lo lleva.
 */
import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/shared/testing/render";
import { MarginRow } from "./margin-row";

describe("MarginRow", () => {
  it("reparte margen, texto y cola en tres columnas con el margen de la casa", () => {
    renderWithProviders(
      <MarginRow data-testid="fila" margin={<span data-testid="glifo">I</span>} trailing="3 pts">
        Parcial de Cálculo III
      </MarginRow>,
    );
    const fila = screen.getByTestId("fila");
    expect(fila.className).toContain("grid-cols-[var(--margen)_1fr_auto]");
    expect(fila.className).toContain("border-b");
    expect(fila.className).toContain("last:border-b-0");
    expect(screen.getByTestId("glifo").parentElement).toHaveAttribute("data-slot", "margin-row-margin");
    expect(screen.getByText("Parcial de Cálculo III")).toHaveAttribute("data-slot", "margin-row-text");
    expect(screen.getByText("3 pts")).toHaveAttribute("data-slot", "margin-row-trailing");
  });

  it("sin cola sólo hay margen y texto", () => {
    const { container } = renderWithProviders(<MarginRow margin={null}>Zona horaria</MarginRow>);
    expect(container.querySelector("[data-slot=margin-row-trailing]")).toBeNull();
    expect(container.querySelector("[data-slot=margin-row-margin]")).not.toBeNull();
  });
});
