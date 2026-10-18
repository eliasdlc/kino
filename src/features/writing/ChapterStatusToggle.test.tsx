/**
 * Criterio: el estado del capítulo se dice con palabras y en el color de su
 * estado. Terminado es `--ok` (como una tarea hecha) y no el ámbar de la
 * acción, mientras se guarda la palabra dice «Guardando» en vez de girar un
 * icono, y la fila del panel del teléfono es un botón de verdad. El nombre dice
 * el estado y lo que hace el toque, sin aria-pressed que lo repita, y concuerda
 * con el género del medium («la escena», «terminada»).
 */
import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { api } from "@convex/_generated/api";
import { makeTestConvexClient, renderWithProviders, stubMutationPending } from "@/shared/testing/render";
import { ChapterStatusToggle } from "./ChapterStatusToggle";

vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

describe("ChapterStatusToggle", () => {
  it("terminado va en --ok con su palabra, nunca en ámbar", () => {
    renderWithProviders(
      <ChapterStatusToggle pageId="p1" systemId="s1" title="La subida" initialCompletedAt="2026-10-01" />,
    );
    const boton = screen.getByRole("button", { name: /^Terminado: marcar el capítulo como en curso$/ });
    expect(boton).not.toHaveAttribute("aria-pressed");
    expect(boton).toHaveClass("text-ok");
    expect(boton).not.toHaveClass("text-primary");
  });

  it("mientras se guarda lo dice con una palabra", async () => {
    const pendiente = stubMutationPending(api.writing.setCompleted);
    renderWithProviders(
      <ChapterStatusToggle pageId="p1" systemId="s1" title="La subida" initialCompletedAt={null} />,
      { convex: makeTestConvexClient([], [pendiente.stub]) },
    );
    await userEvent.click(screen.getByRole("button", { name: /En curso/ }));
    expect(await screen.findByText("Guardando")).toBeVisible();
    expect(screen.getByRole("button", { name: /Guardando/ })).toHaveAttribute("aria-busy", "true");
  });

  it("en la fila del panel es un botón que dice qué marca", () => {
    renderWithProviders(
      <ChapterStatusToggle
        pageId="p1"
        systemId="s1"
        title="La subida"
        initialCompletedAt={null}
        variant="fila"
      />,
    );
    const fila = screen.getByRole("button", { name: /Marcar el capítulo como terminado/ });
    expect(fila).not.toHaveAttribute("aria-pressed");
  });

  it("concuerda con el género del medium", () => {
    renderWithProviders(
      <ChapterStatusToggle
        pageId="p1"
        systemId="s1"
        title="Interior, cocina"
        initialCompletedAt={null}
        unit={{ noun: "escena", nounPlural: "escenas", newLabel: "Nueva escena" }}
        variant="fila"
      />,
    );
    expect(screen.getByRole("button", { name: /Marcar la escena como terminada/ })).toBeVisible();
  });
});
