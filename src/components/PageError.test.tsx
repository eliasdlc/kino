/**
 * Criterio: la pantalla de problema habla en español, ofrece reintentar y
 * volver a Hoy, enseña la referencia del error y nunca la traza. El boundary
 * del grupo de la app la usa tal cual.
 */
import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/shared/testing/render";
import AppError from "@/app/(app)/error";

vi.mock("next/navigation", async () => (await import("@/shared/testing/navigation")).navigationMock());

describe("el boundary de la app", () => {
  it("reintenta con su botón, vuelve a Hoy y no enseña la traza", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const reset = vi.fn();
    const error = Object.assign(new Error("Cannot read properties of undefined"), { digest: "d1g3st" });
    renderWithProviders(<AppError error={error} reset={reset} />);

    expect(screen.getByRole("alert")).toBeVisible();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Esta pantalla no se pudo abrir");
    expect(screen.getByRole("link", { name: "Ir a Hoy" })).toHaveAttribute("href", "/dashboard");
    expect(screen.getByText(/Referencia d1g3st/)).toBeVisible();
    expect(screen.queryByText(/Cannot read properties/)).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(reset).toHaveBeenCalledOnce();
  });
});
