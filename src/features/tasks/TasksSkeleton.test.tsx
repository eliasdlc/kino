/**
 * Criterio: el esqueleto de /tasks tiene la forma de la página (CLS). Sale
 * del mismo módulo que la página, reserva el segmento Lista | Calendario y
 * las dos secciones, y cada fila esperando mide lo mismo que una fila de
 * verdad. No anima.
 */
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "@/shared/testing/render";
import { LISTA_FILA_ALTO, TasksPageSkeleton } from "./TasksSkeleton";

describe("TasksPageSkeleton", () => {
  it("reserva el segmento, nueve filas a la altura de las reales y no anima", () => {
    const { container } = renderWithProviders(<TasksPageSkeleton />);
    const filas = container.querySelectorAll("[data-slot=lista-skeleton] > div");
    expect(filas).toHaveLength(9);
    for (const fila of filas) expect(fila).toHaveClass(LISTA_FILA_ALTO);
    expect(container.querySelector(".h-\\[3\\.35rem\\]")).not.toBeNull();
    expect(container.innerHTML).not.toMatch(/animate-/);
  });
});
