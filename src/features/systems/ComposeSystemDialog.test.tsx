/**
 * Criterio: en la composición de un sistema, qué pestañas se ven y en cuál
 * abre son estados, y se anuncian con `aria-pressed` además del color de
 * tinta: un lector de pantalla tiene que saber cuál está elegida. Ocultar una
 * pestaña la saca también de las opciones de «Abre en».
 */
import { describe, expect, it, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { makeSystem } from "@/app/system-design/mock-data";
import { renderWithProviders } from "@/shared/testing/render";
import { ComposeSystemDialog } from "./ComposeSystemDialog";

vi.mock("next/navigation", async () => (await import("@/shared/testing/navigation")).navigationMock());

describe("ComposeSystemDialog, pestañas", () => {
  it("las pestañas visibles se anuncian pulsadas y ocultar una la quita de Abre en", async () => {
    renderWithProviders(
      <ComposeSystemDialog system={makeSystem({ templateType: "custom" })} open onOpenChange={() => {}} />,
    );
    const visibles = screen.getByText("Pestañas visibles").closest("section")!;
    const archivo = within(visibles).getAllByRole("button", { name: "Archivo" })[0]!;
    expect(archivo).toHaveAttribute("aria-pressed", "true");

    await userEvent.click(archivo);

    expect(archivo).toHaveAttribute("aria-pressed", "false");
    expect(within(visibles).getAllByRole("button", { name: "Archivo" })).toHaveLength(1);
  });
});
