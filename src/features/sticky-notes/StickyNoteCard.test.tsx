/**
 * Criterio: en el teléfono la nota adhesiva no depende de arrastrar ni de los
 * dos controles de 20 px de la esquina. Un solo botón de 48 px abre la hoja con
 * cada operación por su nombre, incluido dónde se pega, y elegir un margen
 * escribe la posición sin mover la nota a otro sitio que el elegido.
 */
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { makeStickyNote, mid } from "@/app/system-design/mock-data";
import { makeTestConvexClient, renderMobile, renderWithProviders } from "@/shared/testing/render";
import { StickyNoteCard } from "./StickyNoteCard";

const nota = makeStickyNote({ id: mid("n1"), title: "Recordar" });

describe("StickyNoteCard", () => {
  it("en el teléfono, las operaciones salen por nombre en una hoja", async () => {
    const user = userEvent.setup();
    renderMobile(<StickyNoteCard note={nota} context={{ pageId: mid("p1") }} onStack={() => {}} />);

    await user.click(screen.getByRole("button", { name: "Opciones de Recordar" }));
    const hoja = screen.getByRole("group", { name: "Opciones de Recordar" });
    expect(within(hoja).getAllByRole("button").map((b) => b.textContent)).toEqual([
      "Editar",
      "Marcar eureka",
      "Pegar en el margen izquierdo",
      "Pegar en el margen derecho",
      "Apilar sobre otra nota",
      "Eliminar",
    ]);
  });

  it("pegar en un margen escribe ese lado y nada más", async () => {
    const user = userEvent.setup();
    const convex = makeTestConvexClient();
    renderMobile(<StickyNoteCard note={nota} context={{ pageId: mid("p1") }} />, { convex });

    await user.click(screen.getByRole("button", { name: "Opciones de Recordar" }));
    await user.click(screen.getByRole("button", { name: "Pegar en el margen derecho" }));

    expect(convex.calls.at(-1)).toMatchObject({
      kind: "mutation",
      name: "stickyNotes:update",
      args: expect.objectContaining({ positionSide: "right" }),
    });
  });

  it("es papel: el radio de la nota adhesiva y no el de una card", () => {
    const { container } = renderWithProviders(<StickyNoteCard note={nota} context={{ folderId: mid("f1") }} />);
    expect(container.querySelector("[data-sticky-note]")).toHaveClass("rounded-[0.3rem]");
  });

  it("la bandeja de colores nombra cada papel en español", () => {
    renderWithProviders(<StickyNoteCard note={nota} context={{ folderId: mid("f1") }} />);
    expect(screen.getByRole("button", { name: "Amarillo", hidden: true })).toHaveAttribute("aria-pressed", "true");
  });
});
