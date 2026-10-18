/**
 * Criterio: cuando la búsqueda no encuentra nada, la pantalla nombra las cinco
 * fuentes donde miró y el tope de resultados por fuente. Es la única forma de
 * que el hueco diga «tu nota no existe» en vez de «no la encontré».
 */
import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/shared/testing/render";
import { SEARCH_SOURCES } from "./search.types";
import { SearchEmptyState } from "./SearchEmptyState";

describe("SearchEmptyState", () => {
  it("nombra las cinco fuentes y el término que se buscó", () => {
    renderWithProviders(<SearchEmptyState query="marco teorico" />);

    const linea = screen.getByText(/Nada con/).textContent!;
    for (const fuente of SEARCH_SOURCES) expect(linea).toContain(fuente.fuente);
    expect(linea).toContain("marco teorico");
    expect(SEARCH_SOURCES).toHaveLength(5);
  });

  it("la línea del vacío habla en la voz, como los demás vacíos", () => {
    renderWithProviders(<SearchEmptyState query="daga" />);

    expect(screen.getByText(/Nada con/)).toHaveClass("font-voice", "italic");
  });

  it("declara el tope de ocho por fuente, que hoy no se ve por ningún lado", () => {
    renderWithProviders(<SearchEmptyState query="daga" />);

    expect(screen.getByText(/se enseñan los 8 primeros resultados/)).toBeVisible();
  });
});
