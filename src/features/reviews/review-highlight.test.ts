/**
 * Criterio: el fragmento comentado se resalta sin escribir nada en el
 * documento, y el resaltado sigue al texto mientras la persona lo reescribe.
 * Un fragmento reescrito se distingue de uno que sigue igual, y uno borrado
 * deja de tener rango en vez de anclarse a otro sitio.
 */
import { describe, expect, it } from "vitest";
import { Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { ReviewHighlight, highlightRanges, setHighlightActive, setHighlightComments } from "./review-highlight.extension";
import { rangeSaysQuote } from "./review-locate";

const DOCUMENTO =
  "<p>QSD tiene <strong>firewall</strong> perimetral y respaldos.</p><p>La información puede ser clasificada como prueba.</p>";

function montar(): Editor {
  const el = document.createElement("div");
  document.body.appendChild(el);
  return new Editor({ element: el, extensions: [StarterKit, ReviewHighlight], content: DOCUMENTO });
}

const comentario = (id: string, quote: string) => ({
  id,
  quote,
  prefix: null,
  suffix: null,
  severity: "important" as const,
  category: "evidence" as const,
});

describe("el resaltado de revisión", () => {
  it("pinta la cita aunque cruce una negrita, y no la guarda en el HTML", () => {
    const editor = montar();
    setHighlightComments(editor, [comentario("c1", "firewall perimetral")]);

    const pintado = editor.view.dom.querySelectorAll('[data-review-id="c1"]');
    expect([...pintado].map((n) => n.textContent).join("")).toBe("firewall perimetral");
    expect(editor.getHTML()).not.toContain("review");
    expect(editor.getHTML()).toBe(DOCUMENTO);
  });

  it("lleva el color de su tipo y el peso de su importancia", () => {
    const editor = montar();
    setHighlightComments(editor, [comentario("c1", "respaldos")]);
    const pintado = editor.view.dom.querySelector('[data-review-id="c1"]')!;
    expect(pintado).toHaveClass("review-cat-evidence");
    expect(pintado).toHaveClass("review-anchor-important");
  });

  it("enciende el comentario activo", () => {
    const editor = montar();
    setHighlightComments(editor, [comentario("c1", "respaldos")]);
    setHighlightActive(editor, "c1");
    expect(editor.view.dom.querySelector(".review-anchor-active")?.textContent).toBe("respaldos");
  });

  it("sigue al fragmento cuando se escribe dentro, y sabe que ya no dice lo mismo", () => {
    const editor = montar();
    setHighlightComments(editor, [comentario("c2", "como prueba")]);
    const antes = highlightRanges(editor.state).get("c2")!;
    expect(rangeSaysQuote(editor.state.doc, antes, "como prueba")).toBe(true);

    // Escribir delante del fragmento lo desplaza; escribir dentro lo cambia.
    editor.commands.insertContentAt(1, "Hoy ");
    editor.commands.insertContentAt(highlightRanges(editor.state).get("c2")!.from + 5, "sólida ");
    const despues = highlightRanges(editor.state).get("c2")!;
    expect(editor.state.doc.textBetween(despues.from, despues.to)).toBe("como sólida prueba");
    expect(rangeSaysQuote(editor.state.doc, despues, "como prueba")).toBe(false);
  });

  it("un fragmento borrado se queda sin rango", () => {
    const editor = montar();
    setHighlightComments(editor, [comentario("c3", "respaldos")]);
    const { from, to } = highlightRanges(editor.state).get("c3")!;
    editor.commands.deleteRange({ from, to });
    expect(highlightRanges(editor.state).has("c3")).toBe(false);
  });

  it("una cita que no está no se pinta en ningún sitio", () => {
    const editor = montar();
    setHighlightComments(editor, [comentario("c4", "cortafuegos")]);
    expect(highlightRanges(editor.state).size).toBe(0);
  });
});
