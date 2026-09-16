/**
 * Criterio: en el teléfono la rejilla no engancha ningún listener de arrastre,
 * y el gesto que se pierde tiene su operación con nombre. Era la única de las
 * cinco superficies que contradecía «sin drag and drop en touch», porque
 * enganchaba los listeners siempre, sin rama por viewport.
 *
 * Y en una página la sección existe sólo mientras tenga una nota: sin notas no
 * se pinta ni su cabecera. La carpeta, que no tiene texto del que nazcan las
 * notas, conserva la sección vacía con su botón de añadir.
 */
import { describe, expect, it } from "vitest";
import { fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { api } from "@convex/_generated/api";
import { makeStickyNote, mid } from "@/app/system-design/mock-data";
import {
  makeTestConvexClient,
  renderMobile,
  renderWithProviders,
  stubQuery,
} from "@/shared/testing/render";
import { StickyNotesGrid } from "./StickyNotesGrid";

const PAGINA = "pagina-1";
const PIZARRA = makeStickyNote({ id: mid("nota-1"), title: "Pizarra de clase", content: null });
const RUBRICA = makeStickyNote({ id: mid("nota-2"), title: "Preguntar por la rúbrica", content: null });

function pintar(pintador: typeof renderWithProviders) {
  const convex = makeTestConvexClient([stubQuery(api.stickyNotes.byPage, [PIZARRA, RUBRICA])]);
  const { container } = pintador(<StickyNotesGrid pageId={PAGINA} />, { convex });
  return { convex, container };
}

describe("la sección de notas", () => {
  it("en una página sin notas en la cuadrícula no se pinta", () => {
    const convex = makeTestConvexClient([stubQuery(api.stickyNotes.byPage, [])]);
    renderWithProviders(<StickyNotesGrid pageId={PAGINA} />, { convex });

    expect(screen.queryByText("Notas")).toBeNull();
    expect(screen.queryByRole("button", { name: /Añadir/ })).toBeNull();
  });

  it("tampoco cuando todas sus notas flotan sobre el texto", () => {
    const flotante = makeStickyNote({ id: mid("nota-3"), title: "Flotante", positionSide: "over" });
    const convex = makeTestConvexClient([stubQuery(api.stickyNotes.byPage, [flotante])]);
    renderWithProviders(<StickyNotesGrid pageId={PAGINA} floatingIds={[flotante.id]} />, { convex });

    expect(screen.queryByText("Notas")).toBeNull();
  });

  it("aparece en cuanto una nota está en la cuadrícula", () => {
    pintar(renderWithProviders);

    expect(screen.getByText("Notas")).toBeVisible();
    expect(screen.getByText("Pizarra de clase")).toBeVisible();
  });

  it("en una carpeta vacía se queda, con su botón de añadir", () => {
    const convex = makeTestConvexClient([stubQuery(api.stickyNotes.byFolder, [])]);
    renderWithProviders(<StickyNotesGrid folderId="carpeta-1" />, { convex });

    expect(screen.getByText("Aún no hay notas.")).toBeVisible();
    expect(screen.getByRole("button", { name: /Añadir/ })).toBeVisible();
  });
});

/** Lo que dnd-kit deja en el DOM cuando una nota es arrastrable. */
function notasArrastrables(container: HTMLElement) {
  return container.querySelectorAll("[aria-roledescription='draggable'], [aria-describedby^='DndDescribedBy']");
}

/** Abre el menú de una nota, que en touch se alcanza con pulsación larga. */
async function abrirMenuDe(titulo: string) {
  fireEvent.contextMenu(screen.getByText(titulo));
  return screen.findByRole("menu");
}

describe("StickyNotesGrid en el teléfono", () => {
  it("ninguna nota lleva listeners de arrastre", () => {
    const { container } = pintar(renderMobile);

    expect(screen.getByText("Pizarra de clase")).toBeVisible();
    expect(notasArrastrables(container)).toHaveLength(0);
  });

  it("apilar es una operación con nombre en el menú de la nota", async () => {
    pintar(renderMobile);

    const menu = await abrirMenuDe("Pizarra de clase");

    expect(within(menu).getByRole("menuitem", { name: /Apilar sobre otra nota/ })).toBeVisible();
  });

  it("apilar escribe la misma mutación que escribía el arrastre", async () => {
    const { convex } = pintar(renderMobile);

    const menu = await abrirMenuDe("Pizarra de clase");
    await userEvent.click(within(menu).getByRole("menuitem", { name: /Apilar sobre otra nota/ }));
    const hoja = await screen.findByRole("dialog");
    await userEvent.click(within(hoja).getByRole("button", { name: /Preguntar por la rúbrica/ }));

    expect(convex.calls).toEqual([
      {
        kind: "mutation",
        name: "stickyNotes:stack",
        args: { draggedId: PIZARRA.id, targetId: RUBRICA.id },
      },
    ]);
  });

  it("la hoja no ofrece apilar una nota sobre sí misma", async () => {
    pintar(renderMobile);

    const menu = await abrirMenuDe("Pizarra de clase");
    await userEvent.click(within(menu).getByRole("menuitem", { name: /Apilar sobre otra nota/ }));

    const hoja = await screen.findByRole("dialog");
    expect(within(hoja).queryByRole("button", { name: /Pizarra de clase/ })).toBeNull();
    expect(within(hoja).getByRole("button", { name: /Preguntar por la rúbrica/ })).toBeVisible();
  });
});

describe("StickyNotesGrid en escritorio", () => {
  it("el arrastre sigue existiendo donde hay ratón", () => {
    const { container } = pintar(renderWithProviders);

    expect(notasArrastrables(container).length).toBeGreaterThan(0);
  });

  it("y ahí el menú no ofrece la operación, porque el gesto está", async () => {
    pintar(renderWithProviders);

    const menu = await abrirMenuDe("Pizarra de clase");

    expect(within(menu).queryByRole("menuitem", { name: /Apilar sobre otra nota/ })).toBeNull();
  });
});
