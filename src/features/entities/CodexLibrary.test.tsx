/**
 * Criterio: la biblioteca del codex es un índice y no una rejilla de cards:
 * una sección por tipo con su título y su cuenta, una fila numerada por
 * entidad que abre su ficha, y un estado vacío con título cuando no hay nada.
 */
import { describe, expect, it, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { api } from "@convex/_generated/api";
import { makeEntityDetail, mid, MOCK_SYSTEM_ID } from "@/app/system-design/mock-data";
import { makeTestConvexClient, renderWithProviders, stubQuery } from "@/shared/testing/render";
import { CodexLibrary } from "./CodexLibrary";

vi.mock("next/navigation", async () => (await import("@/shared/testing/navigation")).navigationMock());

const ficha = makeEntityDetail();
const entidad = (id: string, name: string, type: "character" | "location") => ({
  id: mid(id),
  systemId: MOCK_SYSTEM_ID,
  type,
  name,
  aliases: [],
  summary: null,
  coverImageUrl: null,
  createdAt: ficha.createdAt,
  updatedAt: ficha.updatedAt,
});
const ELENCO = [entidad("e1", "Don Fermín", "character"), entidad("e2", "Inés", "character"), entidad("e3", "La loma", "location")];

describe("CodexLibrary", () => {
  it("agrupa por tipo en secciones con cuenta y cada fila abre su ficha", async () => {
    const convex = makeTestConvexClient([
      stubQuery(api.entities.bySystem, ELENCO as never),
      stubQuery(api.entities.byId, { ...ficha, id: mid("e1"), name: "Don Fermín" } as never),
    ]);
    renderWithProviders(<CodexLibrary systemId={MOCK_SYSTEM_ID} />, { convex });

    const personajes = screen.getByRole("region", { name: "Personajes" });
    expect(personajes.querySelector("[data-slot=index-head]")).toHaveTextContent(/Personajes\s*2$/);
    expect(screen.getByRole("region", { name: "Lugares" })).toBeVisible();

    await userEvent.click(within(personajes).getByRole("button", { name: /Don Fermín/ }));

    expect(await screen.findByText("Ficha del codex")).toBeVisible();
  });

  it("sin entidades enseña un estado vacío con título", () => {
    const convex = makeTestConvexClient([stubQuery(api.entities.bySystem, [])]);
    renderWithProviders(<CodexLibrary systemId={MOCK_SYSTEM_ID} />, { convex });

    expect(screen.getByRole("heading", { name: "Tu universo está vacío" })).toBeVisible();
  });
});
