/**
 * Criterio: la primera pintura del capítulo reserva lo mismo que el editor que
 * la sustituye. La fila del título lleva Más a 2.85rem en las dos, la fila del
 * codex tiene su alto mientras llegan las fichas, y el editor arranca en el
 * scroll donde la primera pintura se quedó.
 */
import { describe, expect, it, vi } from "vitest";
import { act, screen, waitFor } from "@testing-library/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { makeTestConvexClient, renderWithProviders, stubQuery } from "@/shared/testing/render";
import { EditorProvider } from "./EditorContext";
import { NotebookEditor } from "./NotebookEditor";
import { PrimeraPinturaDelEditor } from "./NotebookEditorLayout";
import { ConservarScroll } from "./NotebookEditorSurface";
import { PrimeraPinturaContext, RESERVA_CODEX, type PrimeraPintura } from "./primera-pintura";
import type { PageDetailTransport } from "./pages.types";

vi.mock("next/navigation", async () => (await import("@/shared/testing/navigation")).navigationMock());

const page = {
  id: "cap-1",
  title: "La subida",
  content: "<p>La cota del día marcaba 134.</p>",
  systemId: "novela",
  folderId: "obra",
  updatedAt: "2026-10-18T10:00:00.000Z",
} as unknown as PageDetailTransport;

function pintura(extra: Partial<PrimeraPintura> = {}): PrimeraPintura {
  return {
    titulo: "La subida",
    cuerpo: <p>La cota del día marcaba 134.</p>,
    writer: true,
    fichasDelCodex: 2,
    onOpenPanel: () => {},
    guardarScroll: () => {},
    tomarScroll: () => null,
    ...extra,
  };
}

const reserva = (contenedor: HTMLElement) => contenedor.querySelector(`.${CSS.escape(RESERVA_CODEX)}`);

describe("primera pintura del capítulo", () => {
  it("lleva Más a 2.85rem en la fila del título y reserva la fila del codex", () => {
    const { container } = renderWithProviders(
      <PrimeraPinturaContext.Provider value={pintura()}>
        <PrimeraPinturaDelEditor />
      </PrimeraPinturaContext.Provider>,
    );
    expect(screen.getByRole("button", { name: "Más del capítulo" })).toHaveClass("size-[2.85rem]");
    expect(reserva(container)).toBeInTheDocument();
  });

  it("sin fichas del codex no reserva nada", () => {
    const { container } = renderWithProviders(
      <PrimeraPinturaContext.Provider value={pintura({ fichasDelCodex: 0 })}>
        <PrimeraPinturaDelEditor />
      </PrimeraPinturaContext.Provider>,
    );
    expect(reserva(container)).not.toBeInTheDocument();
  });

  it("el editor guarda el mismo alto hasta que llegan las fichas, y entonces las pinta", async () => {
    const convex = makeTestConvexClient([stubQuery(api.pages.byId, page), stubQuery(api.stickyNotes.byPage, [])]);
    const { container } = renderWithProviders(
      <PrimeraPinturaContext.Provider value={pintura()}>
        <EditorProvider initialContent={page.content ?? ""}>
          <NotebookEditor page={page} systemId="novela" writer title="La subida" onTitleChange={() => {}} onOpenPanel={() => {}} />
        </EditorProvider>
      </PrimeraPinturaContext.Provider>,
      { convex },
    );
    expect(screen.getByRole("button", { name: "Más del capítulo" })).toHaveClass("size-[2.85rem]");
    expect(reserva(container)).toBeInTheDocument();

    act(() => convex.publish(stubQuery(api.entities.byPage, [
      { id: "e1" as Id<"entities">, name: "Inés", type: "character", summary: null, coverImageUrl: null, mentionCount: 1 },
    ])));
    expect(await screen.findByRole("button", { name: /Inés/ })).toBeVisible();
    expect(reserva(container)).not.toBeInTheDocument();
  });

  it("el editor arranca en el scroll donde quedó la primera pintura", async () => {
    const contenedor = document.createElement("div");
    let guardado: { contenedor: HTMLElement; top: number } | null = { contenedor, top: 320 };
    renderWithProviders(
      <PrimeraPinturaContext.Provider
        value={pintura({
          tomarScroll: () => {
            const scroll = guardado;
            guardado = null;
            return scroll;
          },
        })}
      >
        <EditorProvider initialContent={page.content ?? ""}>
          <ConservarScroll />
        </EditorProvider>
      </PrimeraPinturaContext.Provider>,
    );
    await waitFor(() => expect(contenedor.scrollTop).toBe(320));
    expect(guardado).toBeNull();
  });

  it("al irse, la primera pintura apunta qué se desplazaba y cuánto", () => {
    const guardarScroll = vi.fn();
    const { container, unmount } = renderWithProviders(
      <div data-testid="main" style={{ overflowY: "auto" }}>
        <PrimeraPinturaContext.Provider value={pintura({ guardarScroll })}>
          <PrimeraPinturaDelEditor />
        </PrimeraPinturaContext.Provider>
      </div>,
    );
    const main = container.querySelector<HTMLElement>("[data-testid=main]")!;
    main.scrollTop = 420;
    unmount();
    expect(guardarScroll).toHaveBeenCalledWith({ contenedor: main, top: 420 });
  });
});
