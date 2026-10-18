/**
 * Criterio: la biblioteca de escritura es un índice de obras. Cada obra
 * desplegada ofrece sus acciones por nombre en pastillas (Leer, Tablero,
 * Capítulo), cuenta los manuscritos de sus partes, se dice dormida en coral
 * con la palabra, y lo que no tiene obra va aparte.
 */
import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { api } from "@convex/_generated/api";
import { makeFolder, makePage, makeSystem, makeWritingOverview, mid } from "@/app/system-design/mock-data";
import { makeTestConvexClient, renderMobile, stubQuery } from "@/shared/testing/render";
import { SystemWritingView } from "./SystemWritingView";

vi.mock("next/navigation", async () => (await import("@/shared/testing/navigation")).navigationMock());

const NOVELA = makeSystem({ id: mid("novela"), templateType: "writing" });
const OBRA = makeFolder({ id: mid("obra"), name: "Primera parte", metadata: { medium: "novel", wordGoal: 80000 }, pageCount: 1 });
const PARTE = makeFolder({ id: mid("parte"), name: "Capítulos 1 a 5", parentId: mid("obra"), pageCount: 1 });

function biblioteca(dias: number) {
  return makeTestConvexClient([
    stubQuery(api.systems.list, [NOVELA]),
    stubQuery(api.folders.bySystem, [OBRA]),
    stubQuery(api.folders.children, [PARTE]),
    stubQuery(api.pages.bySystem, {
      items: [
        makePage({ id: mid("m1"), title: "Prólogo", folderId: mid("obra"), wordCount: 500 }),
        makePage({ id: mid("m2"), title: "Capítulo uno", folderId: mid("parte"), wordCount: 740 }),
        makePage({ id: mid("m3"), title: "Biblia de la novela", folderId: null, wordCount: 136 }),
      ],
      restantes: 0,
    }),
    stubQuery(api.writing.overview, makeWritingOverview({ works: [{ folderId: mid("obra"), lastSessionAt: "2026-09-17T10:00:00.000Z", daysSinceLastSession: dias }] }) as never),
  ]);
}

describe("SystemWritingView", () => {
  it("la obra desplegada ofrece Leer, Tablero y Capítulo como pastillas con nombre", async () => {
    renderMobile(<SystemWritingView system={NOVELA} initialTasks={[]} />, { convex: biblioteca(0) });

    expect(await screen.findByRole("link", { name: "Leer" })).toHaveAttribute("href", `/systems/${NOVELA.id}/folders/${OBRA.id}/lectura`);
    expect(screen.getByRole("link", { name: "Tablero" })).toHaveAttribute("href", `/systems/${NOVELA.id}/folders/${OBRA.id}/tablero`);
    expect(screen.getByRole("button", { name: "Nuevo capítulo" })).toHaveTextContent("Capítulo");
  });

  it("cuenta los manuscritos y las palabras de sus partes contra la meta", async () => {
    renderMobile(<SystemWritingView system={NOVELA} initialTasks={[]} />, { convex: biblioteca(0) });
    expect(await screen.findByText("Novela, 2 manuscritos, 1.240 de 80.000")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Capítulos 1 a 5/ })).toBeInTheDocument();
  });

  it("una obra parada se dice dormida, en coral y con la palabra", async () => {
    renderMobile(<SystemWritingView system={NOVELA} initialTasks={[]} />, { convex: biblioteca(31) });
    expect(await screen.findByText("dormida")).toHaveClass("text-task-overdue");
  });

  it("lo que no tiene obra va en su sección, con la cuenta en el título", async () => {
    renderMobile(<SystemWritingView system={NOVELA} initialTasks={[]} />, { convex: biblioteca(0) });
    const titulo = await screen.findByRole("heading", { name: "Sin obra" });
    expect(titulo.parentElement).toHaveTextContent("Sin obra1 manuscrito");
    expect(screen.getByRole("link", { name: "Biblia de la novela" })).toBeInTheDocument();
  });
});
