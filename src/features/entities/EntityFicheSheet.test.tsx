/**
 * Criterio: en la ficha del codex, quitar una relación es un botón que dice
 * cuál quita (antes era un aspa con un `title`, sin nombre para un lector de
 * pantalla ni objetivo de dedo), y pulsarlo borra esa relación y no otra. El
 * botón que la crea dice lo que hace, no «OK».
 */
import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { api } from "@convex/_generated/api";
import { makeEntityDetail, MOCK_SYSTEM_ID } from "@/app/system-design/mock-data";
import { makeTestConvexClient, renderWithProviders, stubQuery } from "@/shared/testing/render";
import { EntityFicheSheet } from "./EntityFicheSheet";

vi.mock("next/navigation", async () => (await import("@/shared/testing/navigation")).navigationMock());

const FICHA = makeEntityDetail();

function pintar() {
  const convex = makeTestConvexClient([
    stubQuery(api.entities.byId, FICHA),
    stubQuery(api.entities.bySystem, []),
  ]);
  renderWithProviders(
    <EntityFicheSheet entityId={FICHA.id} systemId={MOCK_SYSTEM_ID} open onOpenChange={() => {}} />,
    { convex },
  );
  return convex;
}

describe("EntityFicheSheet, relaciones", () => {
  it("cada relación se quita con un botón que nombra con quién", async () => {
    const convex = pintar();

    await userEvent.click(await screen.findByRole("button", { name: "Quitar la relación con Bruno Salazar" }));

    const borrado = convex.calls.find((c) => c.name === "entities:removeRelation");
    expect(borrado?.args).toMatchObject({ relationId: FICHA.relations[0]!.id });
    expect(screen.getByRole("button", { name: "Quitar la relación con Puerto Ceniza" })).toBeVisible();
  });

  it("el botón de crear una relación dice Relacionar", async () => {
    pintar();

    await userEvent.click(await screen.findByRole("button", { name: "Añadir" }));

    expect(screen.getByRole("button", { name: "Relacionar" })).toBeDisabled();
  });
});
