import Image from "@tiptap/extension-image";
import { Plugin } from "@tiptap/pm/state";

// URL http(s) que apunta a una imagen por extensión de archivo. Solo se acepta
// una URL "pelada" (todo el portapapeles es la URL), no una incrustada en texto.
const IMAGE_URL_REGEX = /^https?:\/\/\S+\.(png|jpe?g|gif|webp|svg|avif)(\?\S*)?$/i;

/** True si el texto es exactamente una URL http(s) que apunta a una imagen. */
export function isImageUrl(text: string): boolean {
  return IMAGE_URL_REGEX.test(text.trim());
}

/**
 * Imágenes por URL externa (D8 / Fase 2.4): sin upload, sin billing. Pegar una
 * URL de imagen la inserta como nodo `image`. El render es el mismo que tendrá
 * el upload cuando llegue (Fase 6): solo cambia el origen del `src`.
 */
export const ImageUrlPaste = Image.extend({
  addProseMirrorPlugins() {
    const nodeType = this.type;
    return [
      new Plugin({
        props: {
          handlePaste: (view, event) => {
            const text = event.clipboardData?.getData("text/plain")?.trim();
            if (!text || !isImageUrl(text)) return false;

            const node = nodeType.create({ src: text });
            view.dispatch(view.state.tr.replaceSelectionWith(node));
            return true;
          },
        },
      }),
    ];
  },
});
