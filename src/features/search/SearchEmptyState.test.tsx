/**
 * Criterio: cuando la búsqueda no encuentra nada, la pantalla nombra las cinco
 * fuentes donde miró y el tope de resultados por fuente. Es la única forma de
 * que el hueco diga «tu nota no existe» en vez de «no la encontré».
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { SEARCH_SOURCES } from "./search.types";
import { SearchEmptyState } from "./SearchEmptyState";

describe("SearchEmptyState", () => {
  it("nombra las cinco fuentes y el término que se buscó", () => {
    render(<SearchEmptyState query="marco teorico" />);

    const linea = screen.getByText(/Nada con/).textContent!;
    for (const fuente of SEARCH_SOURCES) expect(linea).toContain(fuente.fuente);
    expect(linea).toContain("marco teorico");
    expect(SEARCH_SOURCES).toHaveLength(5);
  });

  it("declara el tope de ocho por fuente, que hoy no se ve por ningún lado", () => {
    render(<SearchEmptyState query="daga" />);

    expect(screen.getByText(/se enseñan los 8 primeros resultados/)).toBeVisible();
  });
});
