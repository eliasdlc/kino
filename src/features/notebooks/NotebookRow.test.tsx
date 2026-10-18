/**
 * Criterio: un documento es una fila numerada con su título en Literata, la
 * meta en una línea (cuándo, sus etiquetas, terminado) y la cifra de palabras
 * a la derecha. Sin vista previa del contenido. Con el vocabulario que le da
 * su lista no se suscribe a los sistemas, que cambian con cada tarea.
 */
import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { getFunctionName } from "convex/server";
import { SYSTEM_TYPE_CONFIG } from "@/shared/lib/system-types";
import { makePage, mid, MOCK_SYSTEM_ID } from "@/app/system-design/mock-data";
import { makeTestConvexClient, renderWithProviders } from "@/shared/testing/render";
import { NotebookRow } from "./NotebookRow";

const AHORA = new Date(2026, 9, 18, 12);

describe("NotebookRow", () => {
  it("numera, abre desde el título en la serif y dice sus palabras", () => {
    renderWithProviders(
      <NotebookRow
        page={makePage({
          id: mid("p1"),
          title: "El clima que no cabe",
          wordCount: 1240,
          updatedAt: new Date(2026, 9, 17).toISOString(),
          contentPreview: "La casa dormía cuando",
          tags: [{ id: mid("t"), title: "importante", color: "red", systemId: MOCK_SYSTEM_ID, isDefault: false }],
        })}
        systemId={MOCK_SYSTEM_ID}
        index={2}
        href="/pagina"
        now={AHORA}
      />,
    );

    expect(screen.getByText("2")).toBeInTheDocument();
    const titulo = screen.getByRole("link", { name: "El clima que no cabe" });
    expect(titulo).toHaveAttribute("href", "/pagina");
    expect(titulo).toHaveClass("font-serif");
    expect(screen.getByText("1.240")).toBeInTheDocument();
    expect(screen.getByText("ayer, importante")).toBeInTheDocument();
    expect(screen.queryByText(/La casa dormía/)).not.toBeInTheDocument();
  });

  it("terminado se dice con la palabra en el verde de hecha", () => {
    renderWithProviders(
      <NotebookRow
        page={makePage({ id: mid("p2"), title: "Fin", completedAt: AHORA.toISOString(), updatedAt: AHORA.toISOString() } as never)}
        systemId={MOCK_SYSTEM_ID}
        index={1}
        href="#"
        now={AHORA}
      />,
    );
    expect(screen.getByText("terminado")).toHaveClass("text-ok");
  });

  it("sin título lo dice en vez de dejar la fila vacía", () => {
    renderWithProviders(
      <NotebookRow page={makePage({ id: mid("p3"), title: null, wordCount: 1 })} systemId={MOCK_SYSTEM_ID} index={1} href="#" now={AHORA} />,
    );
    expect(screen.getByRole("link", { name: "Sin título" })).toBeInTheDocument();
    expect(screen.getByText("palabra")).toBeInTheDocument();
  });

  it("con el vocabulario que le da su lista no se suscribe a la lista de sistemas", () => {
    const convex = makeTestConvexClient();
    const watch = vi.spyOn(convex, "watchQuery");
    renderWithProviders(
      <NotebookRow
        page={makePage({ id: mid("p9"), title: "Capítulo 3" })}
        systemId={MOCK_SYSTEM_ID}
        index={1}
        href="/pagina"
        now={AHORA}
        manifest={SYSTEM_TYPE_CONFIG.writing}
      />,
      { convex },
    );
    expect(screen.getByRole("link", { name: "Capítulo 3" })).toBeInTheDocument();
    expect(watch.mock.calls.map(([query]) => getFunctionName(query))).not.toContain("systems:list");
  });
});
