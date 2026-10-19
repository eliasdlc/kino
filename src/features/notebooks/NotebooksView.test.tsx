/**
 * Criterio: la biblioteca de un sistema es un índice numerado con el
 * vocabulario del sistema. Las carpetas llevan numeral romano y los documentos
 * sueltos su número, sin contar los que viven dentro de una carpeta; sin nada
 * dentro dice qué crear primero, y si la lista se recortó lo dice en vez de
 * callarse que faltan documentos.
 */
import { screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { api } from "@convex/_generated/api";
import { makeFolder, makePage, makeSystem, mid, MOCK_SYSTEM_ID } from "@/app/system-design/mock-data";
import { makeTestConvexClient, renderWithProviders, stubQuery } from "@/shared/testing/render";
import type { FolderWithCounts } from "@/features/folders/folders.types";
import type { PageListItemTransport } from "@/features/pages/pages.types";
import { NotebooksView } from "./NotebooksView";

vi.mock("next/navigation", async () => (await import("@/shared/testing/navigation")).navigationMock());

function biblioteca({
  folders,
  pages,
  restantes = 0,
}: {
  folders: FolderWithCounts[];
  pages: PageListItemTransport[];
  restantes?: number;
}) {
  return makeTestConvexClient([
    stubQuery(api.systems.list, [makeSystem({ id: MOCK_SYSTEM_ID, name: "La casa de las cotas", templateType: "writing" })]),
    stubQuery(api.folders.bySystem, folders),
    stubQuery(api.pages.bySystem, { items: pages, restantes }),
    stubQuery(api.tasks.bySystem, []),
    stubQuery(api.tags.bySystem, []),
    stubQuery(api.folders.children, []),
  ]);
}

const OBRAS = [
  makeFolder({ id: mid("obra-1"), name: "Primera parte", systemId: MOCK_SYSTEM_ID }),
  makeFolder({ id: mid("obra-2"), name: "Segunda parte", systemId: MOCK_SYSTEM_ID }),
];

const SUELTOS = [
  makePage({ id: mid("p-1"), title: "Cuaderno de ideas", folderId: null }),
  makePage({ id: mid("p-dentro"), title: "Capítulo uno", folderId: mid("obra-1") }),
  makePage({ id: mid("p-2"), title: "Personajes sueltos", folderId: null }),
];

/** La fila que contiene un enlace: el número vive en su margen. */
function filaDe(name: string): HTMLElement {
  const link = screen.getByRole("link", { name });
  const fila = link.closest<HTMLElement>("[data-folder-row], [data-notebook-row]");
  if (!fila) throw new Error(`"${name}" no está en una fila de índice`);
  return fila;
}

describe("NotebooksView", () => {
  it("numera las obras en romano y los manuscritos sueltos en arábigo, cada sección con su palabra", () => {
    renderWithProviders(<NotebooksView systemId={MOCK_SYSTEM_ID} />, {
      convex: biblioteca({ folders: OBRAS, pages: SUELTOS }),
    });

    const obras = screen.getByRole("region", { name: "Obras" });
    expect(within(obras).getByRole("link", { name: "Primera parte" })).toBeInTheDocument();
    expect(within(filaDe("Primera parte")).getByText("I")).toBeInTheDocument();
    expect(within(filaDe("Segunda parte")).getByText("II")).toBeInTheDocument();

    const sueltos = screen.getByRole("region", { name: "Manuscritos sueltos" });
    expect(within(sueltos).queryByRole("link", { name: "Capítulo uno" })).not.toBeInTheDocument();
    expect(within(filaDe("Cuaderno de ideas")).getByText("1")).toBeInTheDocument();
    expect(within(filaDe("Personajes sueltos")).getByText("2")).toBeInTheDocument();
  });

  it("sin obras ni manuscritos dice qué crear primero, con el vocabulario del sistema", () => {
    renderWithProviders(<NotebooksView systemId={MOCK_SYSTEM_ID} />, {
      convex: biblioteca({ folders: [], pages: [] }),
    });

    expect(screen.getByText("Todavía no tienes manuscritos")).toBeVisible();
    expect(screen.getByRole("button", { name: "Nuevo manuscrito" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Nueva obra" })).toBeVisible();
    expect(screen.queryByRole("region", { name: "Obras" })).not.toBeInTheDocument();
  });

  it("cuando la lista se recortó, dice cuántos enseña y que hay más", () => {
    renderWithProviders(<NotebooksView systemId={MOCK_SYSTEM_ID} />, {
      convex: biblioteca({ folders: OBRAS, pages: SUELTOS, restantes: 40 }),
    });

    expect(
      screen.getByText("Se muestran 3 manuscritos; hay más que no caben en esta lista. Usa Buscar para llegar al resto."),
    ).toBeVisible();
  });

  it("sin recorte no hay aviso", () => {
    renderWithProviders(<NotebooksView systemId={MOCK_SYSTEM_ID} />, {
      convex: biblioteca({ folders: OBRAS, pages: SUELTOS }),
    });

    expect(screen.queryByText(/hay más que no caben/)).not.toBeInTheDocument();
  });
});
