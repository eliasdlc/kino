/**
 * Criterio: los documentos de una carpeta son un índice numerado, y cuando la
 * lectura paró en su tope la carpeta lo dice en vez de dar la lista por
 * completa. Sin tope, no hay aviso.
 */
import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { api } from "@convex/_generated/api";
import { makePage, makeSystem, mid, MOCK_SYSTEM_ID } from "@/app/system-design/mock-data";
import { makeTestConvexClient, renderMobile, stubQuery } from "@/shared/testing/render";
import { FolderDocuments } from "./FolderDocuments";

vi.mock("next/navigation", async () => (await import("@/shared/testing/navigation")).navigationMock());

const CARPETA = mid("carpeta");
const SISTEMA = makeSystem({ id: MOCK_SYSTEM_ID, templateType: "writing" });
const PAGINAS = [
  makePage({ id: mid("d1"), title: "Capítulo 1", folderId: CARPETA }),
  makePage({ id: mid("d2"), title: "Capítulo 2", folderId: CARPETA }),
];

function montar(restantes: number) {
  const lista = { items: PAGINAS, restantes };
  const convex = makeTestConvexClient([
    stubQuery(api.systems.list, [SISTEMA]),
    stubQuery(api.folders.children, []),
    stubQuery(api.pages.bySystem, lista),
  ]);
  renderMobile(
    <FolderDocuments
      systemId={MOCK_SYSTEM_ID}
      folderId={CARPETA}
      initialChildren={[]}
      initialPages={lista}
      emptyCopy={{ title: "Vacía", hint: "Nada" }}
    />,
    { convex },
  );
}

describe("FolderDocuments", () => {
  it("si la lectura paró en su tope, lo dice debajo de la lista", () => {
    montar(1);
    expect(screen.getByRole("link", { name: "Capítulo 2" })).toBeInTheDocument();
    expect(screen.getByText(/hay más que no caben en esta lista/)).toBeInTheDocument();
  });

  it("con la lista completa no avisa de nada", () => {
    montar(0);
    expect(screen.queryByText(/hay más que no caben/)).not.toBeInTheDocument();
  });
});
