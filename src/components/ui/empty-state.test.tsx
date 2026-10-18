/**
 * Criterio: el estado vacío de Diario es un título en display, una frase en
 * la voz (Literata) y, si hay algo que hacer, una acción. Sin ilustración ni
 * icono: en un cuaderno, una página vacía es una invitación a escribir, no
 * un dibujo. La acción es opcional y, cuando falta, no queda ningún hueco.
 */
import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/shared/testing/render";
import { Button } from "./button";
import { EmptyState } from "./empty-state";

describe("EmptyState", () => {
  it("titula en display, habla en la voz y ofrece la acción", () => {
    renderWithProviders(
      <EmptyState
        title="Nada para hoy"
        description="El plan se llena desde Tareas o con el orbe."
        action={<Button>Añadir una tarea</Button>}
      />,
    );
    const titulo = screen.getByRole("heading", { name: "Nada para hoy" });
    expect(titulo.className).toContain("font-display");
    expect(screen.getByText("El plan se llena desde Tareas o con el orbe.").className).toContain("font-voice");
    expect(screen.getByRole("button", { name: "Añadir una tarea" })).toBeVisible();
    expect(document.querySelector("svg, img")).toBeNull();
  });

  it("sin acción no deja hueco", () => {
    const { container } = renderWithProviders(<EmptyState title="Sin vencidas" description="Hoy no debes nada." />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(container.querySelector("[data-slot=empty-state-action]")).toBeNull();
  });
});
