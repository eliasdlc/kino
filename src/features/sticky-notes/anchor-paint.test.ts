/**
 * Criterio: cada frase anotada lleva el color de papel de su nota, y ese color
 * no se guarda nunca en el documento. La nota cambia de papel cuando quiere
 * quien la escribio, y el HTML de la pagina no puede tener que reescribirse por
 * eso: el color entra por decoracion y el documento sigue diciendo solo donde
 * hay un ancla.
 */
import { describe, expect, it } from "vitest";
import { Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { StickyAnchorMark } from "./sticky-anchor.extension";
import { StickyAnchorPaint, setAnchorPaint } from "./anchor-paint.extension";
import { anchorTint } from "./sticky-note-colors";

const ROSA = "#FFB3C1";

/** Una frase anotada (`a1`), y una nota de posicion (`a2`) que no anota nada. */
const DOCUMENTO =
  '<p>El <span data-anchor-id="a1">valor medio</span> cierra el capitulo' +
  ' y <span data-anchor-id="a2" data-anchor-muted="">abre</span> el de series.</p>';

function montar(content = DOCUMENTO): Editor {
  const el = document.createElement("div");
  document.body.appendChild(el);
  return new Editor({
    element: el,
    extensions: [StarterKit, StickyAnchorMark, StickyAnchorPaint],
    content,
  });
}

describe("el color de la frase", () => {
  it("es el papel de su nota", () => {
    const editor = montar();
    setAnchorPaint(editor, { tints: { a1: ROSA }, lit: null });

    expect(editor.view.dom.innerHTML).toContain(`--anchor-tint: ${ROSA}`);
  });

  it("no se escribe en el documento", () => {
    const editor = montar();
    setAnchorPaint(editor, { tints: { a1: ROSA }, lit: null });

    const guardado = editor.getHTML();
    expect(guardado).not.toContain(ROSA);
    expect(guardado).not.toContain("anchor-tint");
    // Lo que sí queda es dónde está el ancla, que es lo único que el documento
    // sabe de una nota.
    expect(guardado).toContain('data-anchor-id="a1"');
  });

  it("no presta color cuando el papel es neutro", () => {
    const editor = montar();
    setAnchorPaint(editor, { tints: { a1: anchorTint("gray") }, lit: null });

    const dom = editor.view.dom.innerHTML;
    expect(dom).toContain("sticky-anchor-tint");
    // Sin `data-anchor-paper` la regla de CSS deja el tinte en el gris de rol.
    expect(dom).not.toContain("data-anchor-paper");
  });

  it("no decora un ancla de posicion", () => {
    const editor = montar();
    setAnchorPaint(editor, { tints: { a1: ROSA, a2: ROSA }, lit: null });

    // Un solo trozo pintado, el de la frase: `a2` solo sostiene su nota.
    expect(editor.view.dom.innerHTML.match(/sticky-anchor-tint/g)).toHaveLength(1);
  });

  it("deja en ambar la frase cuya nota todavia no llego", () => {
    const editor = montar();
    setAnchorPaint(editor, { tints: {}, lit: null });

    expect(editor.view.dom.innerHTML).not.toContain("sticky-anchor-tint");
  });

  it("sigue al texto que se escribe delante", () => {
    const editor = montar();
    setAnchorPaint(editor, { tints: { a1: ROSA }, lit: null });
    editor.commands.insertContentAt(1, "Hoy ");

    // La decoracion se reconstruye con el documento nuevo, asi que la frase no
    // se queda pintada donde estaba antes de escribir.
    const marcado = editor.view.dom.querySelector(".sticky-anchor-tint");
    expect(marcado?.textContent).toBe("valor medio");
  });
});

describe("la pareja encendida", () => {
  it("es la que mira el raton, y solo esa", () => {
    const editor = montar();
    setAnchorPaint(editor, { tints: { a1: ROSA, a2: ROSA }, lit: "a1" });

    expect(editor.view.dom.querySelectorAll(".sticky-anchor-lit")).toHaveLength(1);
    expect(editor.view.dom.querySelector(".sticky-anchor-lit")?.textContent).toBe("valor medio");
  });

  it("se apaga sin tocar el documento", () => {
    const editor = montar();
    setAnchorPaint(editor, { tints: { a1: ROSA }, lit: "a1" });
    const antes = editor.getHTML();

    setAnchorPaint(editor, { tints: { a1: ROSA }, lit: null });

    expect(editor.view.dom.innerHTML).not.toContain("sticky-anchor-lit");
    // Encender y apagar es una decoracion, no una edicion: si tocara el
    // documento, el autoguardado escribiria la pagina por pasar el raton.
    expect(editor.getHTML()).toBe(antes);
  });
});

describe("anchorTint", () => {
  it("presta el papel de los colores que tienen uno", () => {
    expect(anchorTint("pink")).toBe(ROSA);
  });

  it("no presta nada de los papeles neutros, que se resaltan en gris", () => {
    expect(anchorTint("white")).toBeNull();
    expect(anchorTint("gray")).toBeNull();
    expect(anchorTint("black")).toBeNull();
  });
});
