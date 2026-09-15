/**
 * Criterio: el ancla de una nota tiene dos usos y no son el mismo. La que nace
 * de una seleccion anota ese trozo y se ve; la que sostiene una nota soltada en
 * el margen va `muted` y no decora nada, porque nadie pidio anotar ese parrafo.
 */
import { describe, expect, it } from "vitest";
import { Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { StickyAnchorMark } from "./sticky-anchor.extension";
import {
  applyAnchorMarkAtPos,
  applyAnchorMarkOnRange,
  applyAnchorMarkOnText,
  findAnchorRange,
  findAnchorRanges,
  removeAnchorMark,
} from "./anchor-utils";

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

describe("una marca partida en dos nodos", () => {
  /** Una seleccion que cruza un `<strong>` se parte: un span por nodo de texto. */
  function partida() {
    const editor = editorCon("<p>Antes <strong>y dentro</strong> y despues</p>");
    const parrafo = editor.state.doc.firstChild!;
    applyAnchorMarkOnRange(editor, { from: 1, to: 1 + parrafo.content.size }, "a-1");
    return editor;
  }

  it("se encuentra entera, no a medias", () => {
    const editor = partida();

    expect(findAnchorRanges(editor.state.doc, "a-1").length).toBeGreaterThan(1);
    editor.destroy();
  });

  it("se quita entera", () => {
    const editor = partida();

    removeAnchorMark(editor, "a-1");

    expect(findAnchorRanges(editor.state.doc, "a-1")).toEqual([]);
    expect(editor.getHTML()).not.toContain("data-anchor-id");
    // El texto se queda: lo que se va es la marca.
    expect(editor.state.doc.textBetween(0, editor.state.doc.content.size, " ")).toContain(
      "Antes y dentro y despues"
    );
    editor.destroy();
  });
});

describe("la frase de una nota restaurada", () => {
  it("vuelve al mismo rango que tenia antes de borrarla", () => {
    const editor = editorCon("<p>Primero</p><p>La frase anotada va aqui</p>");
    const antes = applyAnchorMarkOnText(editor, "frase anotada", "a-1");
    expect(antes).not.toBeNull();

    removeAnchorMark(editor, "a-1");
    expect(findAnchorRange(editor.state.doc, "a-1")).toBeNull();

    const despues = applyAnchorMarkOnText(editor, "frase anotada", "a-1");

    expect(despues).toEqual(antes);
    expect(findAnchorRange(editor.state.doc, "a-1")).toEqual(antes);
    editor.destroy();
  });

  it("no se escribe si el texto ya no esta", () => {
    const editor = editorCon("<p>El parrafo que la llevaba se borro</p>");

    expect(applyAnchorMarkOnText(editor, "frase anotada", "a-1")).toBeNull();
    expect(editor.getHTML()).not.toContain("data-anchor-id");
    editor.destroy();
  });

  it("se encuentra aunque cruce de un parrafo al siguiente", () => {
    const editor = editorCon("<p>Cierra aqui</p><p>y sigue alla</p>");
    // Es el texto que guarda la nota: `textBetween` mete un espacio en el salto.
    const plano = editor.state.doc.textBetween(0, editor.state.doc.content.size, " ");
    expect(plano).toContain("aqui y sigue");

    const rango = applyAnchorMarkOnText(editor, "aqui y sigue", "a-1");

    expect(rango).not.toBeNull();
    expect(findAnchorRanges(editor.state.doc, "a-1").length).toBeGreaterThan(1);
    editor.destroy();
  });
});
