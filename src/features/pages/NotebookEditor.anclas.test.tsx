/**
 * Criterio: la marca de una nota nace cuando la nota se guarda, no cuando se
 * abre el creador. Antes se escribía al pulsar Sticky, así que cancelar dejaba
 * la frase resaltada sin nota detrás: un documento limpio acababa con marcas
 * que no comentaban nada. Y la marca de una selección se ve, que es lo que la
 * distingue del ancla de posición.
 */
import { useEffect, useRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Editor } from "@tiptap/react";
import { api } from "@convex/_generated/api";
import { makeStickyNote } from "@/app/system-design/mock-data";
import { makeTestConvexClient, renderWithProviders, stubMutation, stubQuery } from "@/shared/testing/render";
import { AnchorBridge } from "@/features/sticky-notes/AnchorBridge";
import { StickyNotesGrid } from "@/features/sticky-notes/StickyNotesGrid";
import { FloatingNotesLayer } from "@/features/sticky-notes/FloatingNotesLayer";
import type { StickyNoteItem } from "@/features/sticky-notes/sticky-notes.types";
import { EditorProvider, useSharedEditor } from "./EditorContext";
import { NotebookEditor } from "./NotebookEditor";
import type { PageDetailTransport } from "./pages.types";

vi.mock("next/navigation", async () => (await import("@/shared/testing/navigation")).navigationMock());

// El menú flotante se coloca midiendo el rectángulo de la selección, y jsdom no
// mide nada, así que nunca llegaría a pintar sus botones. Lo que se prueba aquí
// es lo que hace el botón Sticky, no dónde se pinta: el menú se deja pasar.
vi.mock("@tiptap/react/menus", () => ({
  BubbleMenu: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const page = {
  id: "page-1",
  title: "Sin título",
  content: "<p>Los limites laterales</p>",
  systemId: "university",
  folderId: "calculo",
} as unknown as PageDetailTransport;

/** Saca el editor compartido para poder seleccionar texto como lo hace el ratón. */
function Sonda({ onEditor }: { onEditor: (editor: Editor) => void }) {
  const editor = useSharedEditor();
  useEffect(() => {
    if (editor) onEditor(editor);
  }, [editor, onEditor]);
  return null;
}

function pintar() {
  let editor: Editor | null = null;
  const convex = makeTestConvexClient(
    [stubQuery(api.stickyNotes.byPage, [])],
    [stubMutation(api.stickyNotes.createOnPage, makeStickyNote())],
  );
  renderWithProviders(
    <EditorProvider initialContent={page.content ?? ""}>
      <Sonda onEditor={(e) => (editor = e)} />
      <NotebookEditor page={page} systemId="university" title="Sin título" onTitleChange={() => {}} />
    </EditorProvider>,
    { convex },
  );
  return { convex, editorDe: () => editor! };
}

/** Selecciona «limites» y pulsa Sticky, que es como se anota una frase. */
async function anotarUnaFrase(editorDe: () => Editor) {
  await waitFor(() => expect(editorDe()).not.toBeNull());
  const editor = editorDe();
  const inicio = editor.state.doc.textContent.indexOf("limites") + 1;
  act(() => {
    editor.commands.setTextSelection({ from: inicio, to: inicio + "limites".length });
  });
  await userEvent.click(await screen.findByRole("button", { name: /Sticky/ }));
}

describe("anotar una frase desde la selección", () => {
  it("cancelar no deja ninguna marca en el documento", async () => {
    const { editorDe, convex } = pintar();
    await anotarUnaFrase(editorDe);

    await userEvent.click(await screen.findByRole("button", { name: "Cancelar" }));

    expect(editorDe().getHTML()).not.toContain("data-anchor-id");
    expect(convex.calls).toEqual([]);
  });

  it("guardar la escribe, y se ve: no es un ancla de posición", async () => {
    const { editorDe } = pintar();
    await anotarUnaFrase(editorDe);

    await userEvent.type(await screen.findByPlaceholderText("Título..."), "Repasar");
    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() => expect(editorDe().getHTML()).toContain("data-anchor-id"));
    const html = editorDe().getHTML();
    expect(html).not.toContain("data-anchor-muted");
    // La marca cubre la frase que se seleccionó, no el párrafo entero.
    expect(html).toMatch(/<span data-anchor-id="[^"]+" class="sticky-anchor-mark">limites<\/span>/);
  });
});

/**
 * Una frase anotada que cruza un `<strong>` se guarda partida: el documento
 * escribe un span por nodo de texto. Borrar la nota tiene que llevárselos
 * todos, que es lo que antes no pasaba.
 */
const PARTIDA = "a-partida";
const paginaPartida = {
  ...page,
  content: `<p>Antes <span data-anchor-id="${PARTIDA}" class="sticky-anchor-mark">la frase <strong>anotada</strong></span> y despues</p>`,
} as unknown as PageDetailTransport;

const NOTA_ANCLADA = makeStickyNote({
  id: "nota-anclada" as never,
  title: "Preguntar por esto",
  content: null,
  anchorId: PARTIDA,
  textAnchor: "la frase anotada",
});

function pintarConNota(nota = NOTA_ANCLADA, contenido = paginaPartida.content) {
  let editor: Editor | null = null;
  const convex = makeTestConvexClient(
    [stubQuery(api.stickyNotes.byPage, [nota])],
    [stubMutation(api.stickyNotes.remove, null)],
  );
  renderWithProviders(
    <EditorProvider initialContent={contenido ?? ""}>
      <Sonda onEditor={(e) => (editor = e)} />
      <NotebookEditor page={paginaPartida} systemId="university" title="Sin título" onTitleChange={() => {}} />
      <StickyNotesGrid pageId={paginaPartida.id} />
      <AnchorBridge notes={[nota]} />
    </EditorProvider>,
    { convex },
  );
  return { convex, editorDe: () => editor! };
}

describe("borrar una nota anclada", () => {
  it("se lleva la marca entera, aunque esté partida en dos nodos", async () => {
    const { editorDe, convex } = pintarConNota();
    await waitFor(() => expect(editorDe()).not.toBeNull());
    // El documento nace con la marca partida: dos spans para una sola nota.
    expect(editorDe().getHTML().match(/data-anchor-id/g)).toHaveLength(2);

    await userEvent.click(await screen.findByRole("button", { name: "Eliminar nota" }));

    await waitFor(() => expect(editorDe().getHTML()).not.toContain("data-anchor-id"));
    expect(convex.calls).toEqual([
      { kind: "mutation", name: "stickyNotes:remove", args: { id: NOTA_ANCLADA.id } },
    ]);
    // El texto se queda donde estaba: lo que se fue es el span.
    expect(editorDe().getHTML()).toContain("la frase <strong>anotada</strong>");
  });
});

describe("una nota que vuelve de la papelera", () => {
  it("recupera el resaltado de su frase", async () => {
    // El documento ya no tiene la marca: se fue al borrar la nota.
    const { editorDe } = pintarConNota(NOTA_ANCLADA, "<p>Antes la frase anotada y despues</p>");

    await waitFor(() => expect(editorDe().getHTML()).toContain(`data-anchor-id="${PARTIDA}"`));
    expect(editorDe().getHTML()).not.toContain("data-anchor-muted");
  });

  it("no inventa una marca para un ancla de posición", async () => {
    // Una nota que soltaste en el margen no anotó ninguna frase: sin
    // `textAnchor` no hay nada que volver a marcar, y su sitio es `positionY`.
    const posicional = makeStickyNote({
      id: "nota-posicional" as never,
      anchorId: "a-posicion",
      textAnchor: null,
    });
    const { editorDe } = pintarConNota(posicional, "<p>Antes la frase anotada y despues</p>");

    await waitFor(() => expect(editorDe()).not.toBeNull());
    expect(editorDe().getHTML()).not.toContain("data-anchor-id");
  });
});

/**
 * Mover la nota no puede despegarla de la frase que anota. El arrastre vuelve
 * a anclar la nota al párrafo donde cae, y eso está bien para un ancla de
 * posición, pero sobre una anotación borraba la marca vieja y con ella el
 * resaltado de la frase que alguien eligió a propósito.
 */
function Lienzo({ nota }: { nota: StickyNoteItem }) {
  const containerRef = useRef<HTMLDivElement>(null);
  return (
    <div ref={containerRef} className="relative">
      <FloatingNotesLayer
        notes={[nota]}
        context={{ pageId: paginaPartida.id }}
        containerRef={containerRef}
        metrics={{ columnLeft: 176, columnWidth: 816, containerW: 1168, containerH: 2000 }}
      />
    </div>
  );
}

function pintarFlotante(nota: StickyNoteItem, contenido: string) {
  let editor: Editor | null = null;
  const convex = makeTestConvexClient([stubQuery(api.stickyNotes.byPage, [nota])]);
  renderWithProviders(
    <EditorProvider initialContent={contenido}>
      <Sonda onEditor={(e) => (editor = e)} />
      <NotebookEditor page={paginaPartida} systemId="university" title="Sin título" onTitleChange={() => {}} />
      <Lienzo nota={nota} />
    </EditorProvider>,
    { convex },
  );
  return { convex, editorDe: () => editor! };
}

/** Arrastra la nota. Pasado el umbral de 4 px el gesto es arrastre, no click. */
async function arrastrar(desde: Element) {
  await userEvent.pointer([
    { target: desde, coords: { clientX: 200, clientY: 200 }, keys: "[MouseLeft>]" },
    { coords: { clientX: 320, clientY: 260 } },
    { keys: "[/MouseLeft]" },
  ]);
}

describe("mover una nota que anota una frase", () => {
  const anclada = makeStickyNote({
    id: "nota-flotante-anclada" as never,
    title: "Preguntar por esto",
    content: null,
    positionSide: "over",
    positionX: 0.9,
    positionY: 0.3,
    anchorId: PARTIDA,
    textAnchor: "la frase anotada",
  });

  it("no le quita el resaltado a su frase", async () => {
    const { editorDe, convex } = pintarFlotante(anclada, paginaPartida.content!);
    await waitFor(() => expect(editorDe()).not.toBeNull());

    await arrastrar(screen.getByText("Preguntar por esto"));

    // La marca sigue siendo la misma, sobre el mismo texto y sin enmudecer.
    const html = editorDe().getHTML();
    expect(html).toContain(`data-anchor-id="${PARTIDA}"`);
    expect(html).not.toContain("data-anchor-muted");
    expect(editorDe().state.doc.textContent).toContain("la frase anotada");
    // Y la nota no cambia de ancla: guarda dónde la soltaste, nada más.
    const escrita = convex.calls.find((c) => c.name === "stickyNotes:update");
    expect(escrita?.args).toMatchObject({ id: anclada.id, positionSide: "over" });
    expect(escrita?.args).not.toHaveProperty("anchorId");
  });
});
