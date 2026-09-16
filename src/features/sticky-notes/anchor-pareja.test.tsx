/**
 * Criterio: la nota y la frase que anota son una pareja, y mirar cualquiera de
 * las dos enciende las dos. El color ya dice cuál comenta cuál en el teléfono y
 * en una captura; el encendido es lo que desempata cuando dos notas comparten
 * papel, así que tiene que ir en los dos sentidos y no sólo desde la nota.
 */
import { useEffect } from "react";
import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Editor } from "@tiptap/react";
import { api } from "@convex/_generated/api";
import { makeStickyNote } from "@/app/system-design/mock-data";
import { makeTestConvexClient, renderWithProviders, stubQuery } from "@/shared/testing/render";
import { EditorProvider, useSharedEditor } from "@/features/pages/EditorContext";
import { AnchorHighlightProvider, AnchorPaint } from "./AnchorHighlight";
import { StickyNoteCard } from "./StickyNoteCard";
import type { StickyNoteItem } from "./sticky-notes.types";

vi.mock("next/navigation", async () => (await import("@/shared/testing/navigation")).navigationMock());

const ANCLA = "a-valor-medio";
const CONTENIDO = `<p>El <span data-anchor-id="${ANCLA}">valor medio</span> cierra el capitulo.</p>`;

const NOTA = makeStickyNote({
  id: "nota-rosa" as never,
  title: "Viene en el parcial",
  content: null,
  color: "pink",
  anchorId: ANCLA,
  textAnchor: "valor medio",
});

function Sonda({ onEditor }: { onEditor: (editor: Editor) => void }) {
  const editor = useSharedEditor();
  useEffect(() => {
    if (editor) onEditor(editor);
  }, [editor, onEditor]);
  return null;
}

function pintar(nota: StickyNoteItem = NOTA) {
  let editor: Editor | null = null;
  const convex = makeTestConvexClient([stubQuery(api.stickyNotes.byPage, [nota])]);
  renderWithProviders(
    <EditorProvider initialContent={CONTENIDO}>
      <AnchorHighlightProvider>
        <Sonda onEditor={(e) => (editor = e)} />
        <AnchorPaint notes={[nota]} />
        <StickyNoteCard note={nota} context={{ pageId: "page-1" }} />
      </AnchorHighlightProvider>
    </EditorProvider>,
    { convex },
  );
  return { editorDe: () => editor! };
}

/** El trozo de texto que la decoración pinta, tal y como está en el DOM. */
function frase(editor: Editor): HTMLElement {
  const el = editor.view.dom.querySelector<HTMLElement>(".sticky-anchor-tint");
  expect(el, "la frase anotada no está pintada").not.toBeNull();
  return el!;
}

/** El papel de la nota. Se busca por su marca porque, abierta, su texto son campos. */
function tarjeta(): HTMLElement {
  return document.querySelector("[data-sticky-note]") as HTMLElement;
}

describe("la pareja nota y frase", () => {
  it("nace con el color de papel de la nota", async () => {
    const { editorDe } = pintar();
    await waitFor(() => expect(editorDe()).not.toBeNull());

    await waitFor(() => expect(frase(editorDe()).getAttribute("style")).toContain("#FFB3C1"));
    expect(frase(editorDe()).textContent).toBe("valor medio");
  });

  it("se enciende al mirar la nota", async () => {
    const { editorDe } = pintar();
    await waitFor(() => expect(editorDe()).not.toBeNull());

    await userEvent.hover(tarjeta());

    await waitFor(() => expect(frase(editorDe()).className).toContain("sticky-anchor-lit"));
    expect(tarjeta()).toHaveAttribute("data-lit");
  });

  it("se enciende al mirar la frase", async () => {
    const { editorDe } = pintar();
    await waitFor(() => expect(editorDe()).not.toBeNull());

    await userEvent.hover(frase(editorDe()));

    await waitFor(() => expect(tarjeta()).toHaveAttribute("data-lit"));
    expect(frase(editorDe()).className).toContain("sticky-anchor-lit");
  });

  it("se apaga al salir de la nota", async () => {
    const { editorDe } = pintar();
    await waitFor(() => expect(editorDe()).not.toBeNull());

    await userEvent.hover(tarjeta());
    await waitFor(() => expect(tarjeta()).toHaveAttribute("data-lit"));
    await userEvent.unhover(tarjeta());

    await waitFor(() => expect(tarjeta()).not.toHaveAttribute("data-lit"));
    expect(frase(editorDe()).className).not.toContain("sticky-anchor-lit");
  });

  it("deja la frase encendida mientras el editor de la nota esta abierto", async () => {
    // En el teléfono no hay puntero: abrir la nota es el único gesto que dice
    // cuál de las frases comenta, así que mientras está abierta se queda viva.
    const { editorDe } = pintar();
    await waitFor(() => expect(editorDe()).not.toBeNull());

    await userEvent.click(tarjeta());
    await screen.findByPlaceholderText("Título...");

    await waitFor(() => expect(frase(editorDe()).className).toContain("sticky-anchor-lit"));
    // Y sacar el ratón de la nota no la apaga: la sostiene el editor abierto.
    await userEvent.unhover(tarjeta());
    expect(frase(editorDe()).className).toContain("sticky-anchor-lit");
  });

  it("la apaga al cerrar el editor de la nota", async () => {
    const { editorDe } = pintar();
    await waitFor(() => expect(editorDe()).not.toBeNull());

    await userEvent.click(tarjeta());
    await screen.findByPlaceholderText("Título...");
    await userEvent.keyboard("{Escape}");

    await waitFor(() => expect(frase(editorDe()).className).not.toContain("sticky-anchor-lit"));
  });

  it("no enciende una nota de posicion, que no tiene frase que encender", async () => {
    // El ancla va `muted`: sostiene la nota junto a su párrafo y no marca nada.
    const posicional = makeStickyNote({
      id: "nota-posicional" as never,
      title: "Viene en el parcial",
      content: null,
      anchorId: "a-posicion",
      textAnchor: null,
    });
    const { editorDe } = pintar(posicional);
    await waitFor(() => expect(editorDe()).not.toBeNull());

    await userEvent.hover(tarjeta());

    expect(tarjeta()).not.toHaveAttribute("data-lit");
  });
});
