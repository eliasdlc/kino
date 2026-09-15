/**
 * Criterio: el ancla de una nota tiene dos usos y no son el mismo. La que nace
 * de una seleccion anota ese trozo y se ve; la que sostiene una nota soltada en
 * el margen va `muted` y no decora nada, porque nadie pidio anotar ese parrafo.
 */
import { describe, expect, it } from "vitest";
import { Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { StickyAnchorMark } from "./sticky-anchor.extension";
import { applyAnchorMarkAtPos, findAnchorRange, removeAnchorMark } from "./anchor-utils";

function editorCon(html: string) {
  return new Editor({
    extensions: [StarterKit, StickyAnchorMark],
    content: html,
  });
}

/** El sitio donde empieza el texto de un parrafo, por su numero de orden. */
function inicioDelParrafo(editor: Editor, indice: number): number {
  let visto = -1;
  let pos = 1;
  editor.state.doc.descendants((node, at) => {
    if (node.type.name !== "paragraph") return undefined;
    visto += 1;
    if (visto === indice) pos = at + 1;
    return false;
  });
  return pos;
}

describe("el ancla de posicion", () => {
  it("no decora el texto que sostiene", () => {
    const editor = editorCon("<p>Primero</p><p>Segundo</p>");

    applyAnchorMarkAtPos(editor, inicioDelParrafo(editor, 1), "a-1", true);

    expect(editor.getHTML()).toContain('data-anchor-muted=""');
    editor.destroy();
  });

  it("la de una anotacion si se ve", () => {
    const editor = editorCon("<p>Primero</p><p>Segundo</p>");

    applyAnchorMarkAtPos(editor, inicioDelParrafo(editor, 1), "a-1");

    const html = editor.getHTML();
    expect(html).toContain('data-anchor-id="a-1"');
    expect(html).not.toContain("data-anchor-muted");
    editor.destroy();
  });

  it("sobrevive a que el documento crezca por encima", () => {
    const editor = editorCon("<p>Primero</p><p>Segundo</p>");
    applyAnchorMarkAtPos(editor, inicioDelParrafo(editor, 1), "a-1", true);
    const antes = findAnchorRange(editor.state.doc, "a-1");

    editor.commands.insertContentAt(0, "<p>Relleno nuevo arriba</p>");

    const despues = findAnchorRange(editor.state.doc, "a-1");
    expect(despues).not.toBeNull();
    // El ancla se corrio con su parrafo en vez de quedarse en el sitio viejo.
    expect(despues!.from).toBeGreaterThan(antes!.from);
    editor.destroy();
  });

  it("se puede quitar por su id", () => {
    const editor = editorCon("<p>Primero</p><p>Segundo</p>");
    applyAnchorMarkAtPos(editor, inicioDelParrafo(editor, 1), "a-1", true);

    removeAnchorMark(editor, "a-1");

    expect(findAnchorRange(editor.state.doc, "a-1")).toBeNull();
    editor.destroy();
  });
});

describe("un ancla al final de una linea", () => {
  it("se escribe igual, marcando el texto de detras", () => {
    const editor = editorCon("<p>Primero</p><p>Corto</p>");
    // El final del segundo parrafo: no hay nada delante que marcar. Es donde
    // cae el click cuando pegas la nota a la altura de un parrafo corto.
    const finalDelSegundo = editor.state.doc.content.size - 2;

    applyAnchorMarkAtPos(editor, finalDelSegundo, "a-fin", true);

    expect(findAnchorRange(editor.state.doc, "a-fin")).not.toBeNull();
    expect(editor.getHTML()).toContain('data-anchor-id="a-fin"');
    editor.destroy();
  });
});
