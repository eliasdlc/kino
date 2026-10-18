/**
 * Criterio: la cabecera de un sistema es la de Diario. El glifo va en un tile
 * del color del sistema, la intención en la voz, tres lecturas en cifras y
 * pestañas-palabra; en escritura, Manuscritos primero y Estudio y Codex como
 * enlaces. Sus acciones son una hoja con nombre en el teléfono.
 */
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { api } from "@convex/_generated/api";
import { makeFolder, makePage, makeSystem, makeWritingOverview, mid } from "@/app/system-design/mock-data";
import { makeTestConvexClient, renderMobile, stubQuery } from "@/shared/testing/render";
import { setNavigation } from "@/shared/testing/navigation";
import { SystemDetailHeader } from "./SystemDetailHeader";

vi.mock("next/navigation", async () => (await import("@/shared/testing/navigation")).navigationMock());

const NOVELA = makeSystem({
  id: mid("novela"),
  name: "La casa de las cotas",
  templateType: "writing",
  color: "purple",
  icon: "feather",
  identityStatement: "Escribo mil palabras antes de que el día me alcance.",
  energyIdeal: "high",
  expectedFrequency: "daily",
});
const senales = { status: "active" as const, stale: false, activeTaskCount: 3, nextDueDate: null, daysSinceLastActivity: 2 };

function escritura() {
  return makeTestConvexClient([
    stubQuery(api.systems.list, [NOVELA]),
    stubQuery(api.writing.overview, makeWritingOverview({ wordsToday: 250, works: [{ folderId: mid("obra"), lastSessionAt: "2026-10-17T10:00:00.000Z", daysSinceLastSession: 1 }] }) as never),
    stubQuery(api.folders.bySystem, [makeFolder({ id: mid("obra"), metadata: { wordGoal: 80000 } })]),
    stubQuery(api.pages.bySystem, { items: [makePage({ id: mid("p"), folderId: mid("obra"), wordCount: 136 })], restantes: 0 }),
  ]);
}

describe("SystemDetailHeader", () => {
  it("dice el tipo, la energía y la frecuencia en el eyebrow, y la intención en la voz", () => {
    setNavigation({ search: "" });
    renderMobile(<SystemDetailHeader system={NOVELA} signals={senales} landing="docs" />, { convex: escritura() });

    expect(screen.getByRole("heading", { level: 1, name: "La casa de las cotas" })).toBeInTheDocument();
    expect(screen.getByText("Escritura, energía alta, diario")).toBeInTheDocument();
    expect(screen.getByText(NOVELA.identityStatement!)).toHaveClass("font-voice", "italic");
  });

  it("escritura lee palabras de hoy, lo escrito contra la meta y los días sin sesión", async () => {
    setNavigation({ search: "" });
    renderMobile(<SystemDetailHeader system={NOVELA} signals={senales} landing="docs" />, { convex: escritura() });

    expect(await screen.findByText("palabras hoy")).toBeInTheDocument();
    expect(screen.getByText("250")).toBeInTheDocument();
    expect(screen.getByText("de 80.000")).toBeInTheDocument();
    expect(screen.getByText("día sin sesión")).toBeInTheDocument();
  });

  it("pestañas-palabra: Manuscritos primero, y Estudio y Codex son enlaces", () => {
    setNavigation({ search: "" });
    renderMobile(<SystemDetailHeader system={NOVELA} signals={senales} landing="docs" />, { convex: escritura() });

    const pestanas = screen.getAllByRole("tab").map((t) => t.textContent);
    expect(pestanas).toEqual(["Manuscritos", "Tareas"]);
    expect(screen.getByRole("tab", { name: "Manuscritos" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("link", { name: "Estudio" })).toHaveAttribute("href", `/systems/${NOVELA.id}/estudio`);
    expect(screen.getByRole("link", { name: "Codex" })).toHaveAttribute("href", `/systems/${NOVELA.id}/codex`);
  });

  it("un sistema que no es de escritura no ofrece Estudio ni Codex", () => {
    setNavigation({ search: "" });
    const uni = makeSystem({ id: mid("uni"), templateType: "personal" });
    renderMobile(<SystemDetailHeader system={uni} signals={senales} landing="tasks" />, {
      convex: makeTestConvexClient([stubQuery(api.systems.list, [uni])]),
    });
    expect(screen.getAllByRole("tab")[0]).toHaveTextContent("Tareas");
    expect(screen.queryByRole("link", { name: "Estudio" })).not.toBeInTheDocument();
  });

  it("en el teléfono las acciones del sistema son una hoja con nombre", async () => {
    const user = userEvent.setup();
    setNavigation({ search: "" });
    renderMobile(<SystemDetailHeader system={NOVELA} signals={senales} landing="docs" />, { convex: escritura() });

    await user.click(screen.getByRole("button", { name: "Opciones de La casa de las cotas" }));
    const hoja = screen.getByRole("group", { name: "Opciones de La casa de las cotas" });
    expect(within(hoja).getAllByRole("button").map((b) => b.textContent)).toEqual([
      "Editar sistema",
      "Exportar JSON",
      "Eliminar sistema",
    ]);
  });
});
