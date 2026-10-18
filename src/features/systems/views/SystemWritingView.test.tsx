/**
 * Criterio: la biblioteca de escritura es un índice de obras. Cada obra
 * desplegada ofrece sus acciones por nombre en pastillas (Leer, Tablero,
 * Capítulo), cuenta los manuscritos de sus partes, se dice dormida en coral
 * con la palabra, y lo que no tiene obra va aparte. Leer y Tablero sólo se
 * ofrecen si la carpeta de la obra tiene capítulos que leer, y sólo la
 * primera obra llega desplegada.
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

const PROLOGO = makePage({ id: mid("m1"), title: "Prólogo", folderId: mid("obra"), wordCount: 500 });
const EN_PARTE = makePage({ id: mid("m2"), title: "Capítulo uno", folderId: mid("parte"), wordCount: 740 });
const SUELTO = makePage({ id: mid("m3"), title: "Biblia de la novela", folderId: null, wordCount: 136 });

function biblioteca(dias: number, paginas = [PROLOGO, EN_PARTE, SUELTO], obras = [OBRA]) {
  return makeTestConvexClient([
    stubQuery(api.systems.list, [NOVELA]),
    stubQuery(api.folders.bySystem, obras),
    stubQuery(api.folders.children, [PARTE]),
    stubQuery(api.pages.bySystem, { items: paginas, restantes: 0 }),
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

  it("sin capítulos en la carpeta de la obra no ofrece Leer ni Tablero, que llevarían a una página vacía", async () => {
    renderMobile(<SystemWritingView system={NOVELA} initialTasks={[]} />, { convex: biblioteca(0, [EN_PARTE, SUELTO]) });
    expect(await screen.findByRole("button", { name: "Nuevo capítulo" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Leer" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Tablero" })).not.toBeInTheDocument();
  });

  it("sólo la primera obra llega desplegada; las demás esperan a que las abran", async () => {
    const SEGUNDA = makeFolder({ id: mid("obra2"), name: "Segunda parte", metadata: { medium: "novel" }, pageCount: 0 });
    renderMobile(<SystemWritingView system={NOVELA} initialTasks={[]} />, { convex: biblioteca(0, undefined, [OBRA, SEGUNDA]) });
    expect(await screen.findByRole("button", { name: "Plegar Primera parte" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: "Desplegar Segunda parte" })).toHaveAttribute("aria-expanded", "false");
  });
});
