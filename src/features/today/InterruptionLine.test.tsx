/**
 * Criterio: encima del plan hay como mucho una línea, con el título clampado a
 * dos líneas y dos botones que hacen algo. Los dos acusan recibo, porque lo que
 * la cola mide es si hubo respuesta y no cuál fue. Sin candidato no se pinta
 * nada, ni un hueco ni un esqueleto.
 */
import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { api } from "@convex/_generated/api";
import { makeTestConvexClient, renderWithProviders, stubQuery } from "@/shared/testing/render";
import { InterruptionLine } from "./InterruptionLine";

const conRitual = (vencidas: number) =>
  makeTestConvexClient([
    stubQuery(api.today.interruption, { kind: "ritual", key: "2026-09-13", surfacedAt: null, payload: { vencidas } }),
  ]);

const nombres = (convex: ReturnType<typeof makeTestConvexClient>) => convex.calls.map((call) => call.name);

describe("InterruptionLine", () => {
  it("una sola línea, con la cifra, clampada a dos líneas y con sus dos botones", () => {
    renderWithProviders(<InterruptionLine />, { convex: conRitual(4) });
    const texto = screen.getByText(/esperan un día esta semana/);
    expect(texto).toHaveClass("line-clamp-2");
    expect(screen.getByText("4 vencidas")).toBeVisible();
    expect(screen.getByRole("button", { name: "Repartir" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Ahora no" })).toBeVisible();
  });

  it("marca que se mostró en cuanto se pinta: el reloj de los dos días arranca al verla", () => {
    const convex = conRitual(1);
    renderWithProviders(<InterruptionLine />, { convex });
    expect(nombres(convex)).toContain("today:markSurfaced");
  });

  it("los dos botones acusan recibo", async () => {
    const usuario = userEvent.setup();

    const conAhoraNo = conRitual(2);
    const primero = renderWithProviders(<InterruptionLine />, { convex: conAhoraNo });
    await usuario.click(screen.getByRole("button", { name: "Ahora no" }));
    expect(nombres(conAhoraNo)).toContain("today:acknowledge");
    // Se desmonta antes del segundo: «Repartir» abre el diálogo, y un diálogo
    // abierto bloquea los clics de todo lo que quede detrás.
    primero.unmount();

    const conRepartir = conRitual(2);
    renderWithProviders(<InterruptionLine />, { convex: conRepartir });
    await usuario.click(screen.getByRole("button", { name: "Repartir" }));
    expect(nombres(conRepartir)).toContain("today:acknowledge");
  });

  it("sin interrupción no pinta nada, en vez de un hueco", () => {
    const convex = makeTestConvexClient([stubQuery(api.today.interruption, null)]);
    const { container } = renderWithProviders(<InterruptionLine />, { convex });
    expect(container).toBeEmptyDOMElement();
    expect(nombres(convex)).not.toContain("today:markSurfaced");
  });
});
