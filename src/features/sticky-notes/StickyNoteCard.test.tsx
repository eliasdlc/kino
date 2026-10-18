/**
 * Criterio: en el teléfono la nota no depende de arrastrar ni de controles de
 * 20 px: un botón de 48 px abre sus operaciones por nombre, con sitio propio
 * sobre el título. Borrarla, que también quita su marca del texto, pide
 * confirmación, y ningún control de la nota vive dentro de otro.
 */
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
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


  it("la bandeja de colores nombra cada papel en español", () => {
    renderWithProviders(<StickyNoteCard note={nota} context={{ folderId: mid("f1") }} />);
    expect(screen.getByRole("button", { name: "Amarillo", hidden: true })).toHaveAttribute("aria-pressed", "true");
  });
});

const borrados = (convex: ReturnType<typeof makeTestConvexClient>) =>
  convex.calls.filter((c) => c.kind === "mutation" && c.name === "stickyNotes:remove");

describe("borrar una nota", () => {
  it("en escritorio, la X pide confirmar y cancelar no borra nada", async () => {
    const user = userEvent.setup();
    const { convex } = renderWithProviders(<StickyNoteCard note={nota} context={{ pageId: mid("p1") }} />);

    await user.click(screen.getByRole("button", { name: "Eliminar nota" }));
    const dialogo = await screen.findByRole("dialog");
    expect(dialogo).toHaveTextContent('"Recordar" se eliminará.');
    expect(borrados(convex)).toHaveLength(0);

    await user.click(within(dialogo).getByRole("button", { name: "Cancelar" }));
    expect(borrados(convex)).toHaveLength(0);
  });

  it("sólo borra después de confirmar", async () => {
    const user = userEvent.setup();
    const { convex } = renderWithProviders(<StickyNoteCard note={nota} context={{ pageId: mid("p1") }} />);

    await user.click(screen.getByRole("button", { name: "Eliminar nota" }));
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Eliminar" }));

    expect(borrados(convex)).toEqual([{ kind: "mutation", name: "stickyNotes:remove", args: { id: nota.id } }]);
  });

  it("en el teléfono, Eliminar de la hoja también confirma y nombra la nota por sus primeras palabras", async () => {
    const user = userEvent.setup();
    const sinTitulo = makeStickyNote({
      id: mid("n2"),
      title: null,
      content: "preguntar al tutor por la rúbrica del segundo parcial",
    });
    const { convex } = renderMobile(<StickyNoteCard note={sinTitulo} context={{ pageId: mid("p1") }} />);

    await user.click(screen.getByRole("button", { name: "Opciones de Nota" }));
    await user.click(screen.getByRole("button", { name: "Eliminar" }));
    const dialogo = await screen.findByRole("dialog", { name: "Eliminar nota" });
    expect(dialogo).toHaveTextContent('"preguntar al tutor por la rúbrica…" se eliminará.');
    expect(borrados(convex)).toHaveLength(0);

    await user.click(within(dialogo).getByRole("button", { name: "Eliminar" }));
    expect(borrados(convex)).toHaveLength(1);
  });
});

describe("los controles de la nota", () => {
  it("ninguno vive dentro de otro: editar es un botón y los de la esquina van a su lado", () => {
    renderWithProviders(<StickyNoteCard note={nota} context={{ pageId: mid("p1") }} />);

    const botones = screen.getAllByRole("button");
    for (const boton of botones) {
      expect(within(boton).queryAllByRole("button")).toHaveLength(0);
    }
    expect(screen.getByRole("button", { name: /Editar nota: Recordar/ })).toBeInTheDocument();
  });

  it("el control de esquina tiene su hueco antes del título, que el texto rodea", () => {
    // jsdom no calcula layout, así que no hay solape que medir: lo que se
    // comprueba es que el hueco existe y va antes del texto, que es lo que hace
    // que el título fluya a su alrededor en vez de pasar por debajo del botón.
    renderMobile(<StickyNoteCard note={nota} context={{ pageId: mid("p1") }} />);

    const titulo = screen.getByText("Recordar");
    const hueco = titulo.parentElement!.querySelector("[data-reserva-esquina]");
    expect(hueco).toBeInTheDocument();
    expect(hueco).toHaveAttribute("aria-hidden");
    expect(hueco!.compareDocumentPosition(titulo) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );
  });
});

describe("la bandeja de colores", () => {
  afterEach(() => vi.restoreAllMocks());

  /** Pone la nota a `abajo` px del borde inferior de su contenedor. */
  function pintarEnContenedor(abajo: number) {
    const { container } = renderWithProviders(
      <div data-notes-bounds>
        <StickyNoteCard note={nota} context={{ pageId: mid("p1") }} />
      </div>
    );
    const limite = container.querySelector<HTMLElement>("[data-notes-bounds]")!;
    const papel = container.querySelector<HTMLElement>("[data-sticky-note]")!.parentElement!;
    const bandeja = screen.getByRole("button", { name: "Rosa", hidden: true }).parentElement!;
    vi.spyOn(limite, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, 600, 800));
    vi.spyOn(papel, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 800 - abajo - 176, 176, 176));
    Object.defineProperty(bandeja, "offsetHeight", { configurable: true, value: 70 });
    return bandeja;
  }

  it("pegada al final del contenedor se abre hacia arriba, sin mover la nota", async () => {
    const bandeja = pintarEnContenedor(10);

    await userEvent.click(screen.getByText("Recordar"));

    expect(bandeja).toHaveAttribute("data-lado", "arriba");
    expect(bandeja).not.toHaveAttribute("inert");
  });

  it("con sitio debajo se abre por abajo", async () => {
    const bandeja = pintarEnContenedor(300);

    await userEvent.click(screen.getByText("Recordar"));

    expect(bandeja).toHaveAttribute("data-lado", "abajo");
  });
});

describe("editar con el dedo", () => {
  afterEach(() => vi.restoreAllMocks());

  it("el foco deja que el cuaderno suba el campo sobre el teclado", async () => {
    const original = window.matchMedia;
    vi.spyOn(window, "matchMedia").mockImplementation((query: string) => {
      const respuesta = original(query);
      if (query !== "(pointer: coarse)") return respuesta;
      return { ...respuesta, matches: true };
    });
    const foco = vi.spyOn(HTMLTextAreaElement.prototype, "focus");
    renderWithProviders(<StickyNoteCard note={nota} context={{ pageId: mid("p1") }} />);

    await userEvent.click(screen.getByText("Recordar"));

    expect(await screen.findByPlaceholderText("Escribe aquí...")).toHaveFocus();
    expect(foco).toHaveBeenCalledWith({ preventScroll: false });
  });
});
