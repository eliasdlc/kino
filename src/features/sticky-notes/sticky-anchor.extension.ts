import { Mark } from "@tiptap/react";

/**
 * El ancla de una nota adhesiva dentro del texto.
 *
 * Tiene dos usos y no son el mismo. Una nota nacida de una seleccion **anota**
 * ese trozo, y se ve: es la frase que marcaste a proposito. Una nota que
 * soltaste en el margen solo necesita saber junto a que parrafo viaja para no
 * deslizarse cuando el documento crece, y eso no es anotar nada: va con
 * `muted`, que la deja sin decoracion.
 */
export const StickyAnchorMark = Mark.create({
  name: "stickyAnchor",
  // Don't extend the mark when typing adjacent text
  inclusive: false,
  excludes: "",

  addAttributes() {
    return {
      anchorId: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute("data-anchor-id"),
        renderHTML: (attrs: { anchorId: string | null }) =>
          attrs.anchorId ? { "data-anchor-id": attrs.anchorId } : {},
      },
      /** Ancla de posicion: sostiene la nota, no marca el texto. */
      muted: {
        default: false,
        parseHTML: (el: HTMLElement) => el.hasAttribute("data-anchor-muted"),
        renderHTML: (attrs: { muted: boolean }) =>
          attrs.muted ? { "data-anchor-muted": "" } : {},
      },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-anchor-id]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["span", { ...HTMLAttributes, class: "sticky-anchor-mark" }, 0];
  },
});
