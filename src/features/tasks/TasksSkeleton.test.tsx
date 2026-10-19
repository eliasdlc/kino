/**
 * Criterio: el esqueleto de /tasks tiene la forma de la página (CLS). Sale
 * del mismo módulo que la página y pinta igual lo que es fijo: el título, la
 * voz entera (a dos líneas en el teléfono), el segmento y los títulos de
 * sección. Reserva el presupuesto a su altura real, un hueco de Vencidas y
 * las filas a la altura de las de verdad. No anima.
 */
import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/shared/testing/render";
import { LISTA_FILA_ALTO, TasksPageSkeleton, VOZ_LISTA, VOZ_TAREAS } from "./TasksSkeleton";

describe("TasksPageSkeleton", () => {
  it("pinta la cabecera de verdad: el título y la voz entera con su clase", () => {
    renderWithProviders(<TasksPageSkeleton />);
    expect(screen.getByRole("heading", { level: 1, name: "Tareas" })).toBeInTheDocument();
    const voz = screen.getByText(VOZ_LISTA);
    for (const clase of VOZ_TAREAS.split(" ")) expect(voz).toHaveClass(clase);
  });

  it("reserva el presupuesto a 4,5 rem, un hueco de Vencidas y las filas a su altura", () => {
    const { container } = renderWithProviders(<TasksPageSkeleton />);
    expect(container.querySelector("[data-slot=presupuesto-skeleton]")).toHaveClass("h-[4.5rem]");
    expect(screen.getByText("Vencidas")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Sugerido para hoy" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Todas las tareas" })).toBeInTheDocument();
    const filas = container.querySelectorAll("[data-slot=lista-skeleton-fila]");
    expect(filas).toHaveLength(13);
    for (const fila of filas) expect(fila).toHaveClass(LISTA_FILA_ALTO);
  });

  it("reserva el segmento y la acción de escritorio, y no anima", () => {
    const { container } = renderWithProviders(<TasksPageSkeleton />);
    expect(container.querySelector(".h-\\[3\\.35rem\\]")).not.toBeNull();
    expect(container.querySelector(".max-md\\:hidden .h-\\[2\\.85rem\\]")).not.toBeNull();
    expect(container.innerHTML).not.toMatch(/animate-/);
  });
});
