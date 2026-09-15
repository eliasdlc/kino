import { Extension } from "@tiptap/react";
import type { Editor } from "@tiptap/react";
import type { Node as PmNode } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { annotationRanges } from "./anchor-utils";

/**
 * Lo que la lista de notas le presta al editor para pintar sus frases.
 *
 * El color no viaja en el documento: una nota cambia de papel cuando le da la
 * gana a quien la escribio, y el HTML guardado no puede tener que reescribirse
 * por eso. Sale de la lista de notas, que ya es reactiva, y entra aqui.
 */
export interface AnchorPaint {
  /**
   * Color de resaltado por ancla. `null` es un papel neutro, que no tiene
   * color que prestar: esa frase se queda con el ambar del acento.
   */
  tints: Readonly<Record<string, string | null>>;
  /** El ancla de la pareja encendida, que es la que mira el raton. */
  lit: string | null;
}

interface PaintState extends AnchorPaint {
  decorations: DecorationSet;
}

const VACIO: AnchorPaint = { tints: {}, lit: null };

export const anchorPaintKey = new PluginKey<PaintState>("stickyAnchorPaint");

/**
 * Una decoracion por frase anotada cuya nota conocemos.
 *
 * Un ancla que todavia no tiene nota en la lista se queda fuera a proposito:
 * sin decoracion la marca conserva el ambar, que es el suelo del resaltado
 * mientras las notas llegan.
 */
function pintar(doc: PmNode, { tints, lit }: AnchorPaint): DecorationSet {
  const decoraciones: Decoration[] = [];
  for (const { anchorId, from, to } of annotationRanges(doc)) {
    if (!(anchorId in tints)) continue;
    const tint = tints[anchorId];
    decoraciones.push(
      Decoration.inline(from, to, {
        class: anchorId === lit ? "sticky-anchor-tint sticky-anchor-lit" : "sticky-anchor-tint",
        // `data-anchor-paper` separa las dos escalas de tinte: un pastel de
        // papel es casi blanco y necesita mucha mas mezcla que el ambar.
        ...(tint ? { style: `--anchor-tint: ${tint}`, "data-anchor-paper": "" } : {}),
      })
    );
  }
  return DecorationSet.create(doc, decoraciones);
}

/**
 * Pinta cada frase anotada con el color de papel de su nota.
 *
 * Es decoracion y no atributo de la marca porque el color no se guarda: la
 * marca dice que ahi hay un ancla, y esto dice de que color se ve hoy.
 */
export const StickyAnchorPaint = Extension.create({
  name: "stickyAnchorPaint",

  addProseMirrorPlugins() {
    return [
      new Plugin<PaintState>({
        key: anchorPaintKey,
        state: {
          init: (_config, state) => ({ ...VACIO, decorations: pintar(state.doc, VACIO) }),
          apply(tr, anterior, _oldState, nuevo) {
            const meta = tr.getMeta(anchorPaintKey) as AnchorPaint | undefined;
            // Sin colores nuevos y sin texto nuevo, las decoraciones de antes
            // siguen valiendo: escribir no puede recorrer el documento entero.
            if (!meta && !tr.docChanged) return anterior;
            const paint = meta ?? { tints: anterior.tints, lit: anterior.lit };
            return { ...paint, decorations: pintar(nuevo.doc, paint) };
          },
        },
        props: {
          decorations: (state) => anchorPaintKey.getState(state)?.decorations,
        },
      }),
    ];
  },
});

function mismosTintes(a: AnchorPaint["tints"], b: AnchorPaint["tints"]): boolean {
  const claves = Object.keys(a);
  return claves.length === Object.keys(b).length && claves.every((k) => a[k] === b[k]);
}

/**
 * Le entrega al editor los colores y la pareja encendida.
 *
 * Sale sin despachar nada si no cambio ninguno de los dos: la lista de notas
 * llega en un array nuevo cada vez que Convex responde, y una transaccion por
 * respuesta no pinta nada distinto.
 */
export function setAnchorPaint(editor: Editor, next: AnchorPaint): void {
  const actual = anchorPaintKey.getState(editor.state);
  if (actual && actual.lit === next.lit && mismosTintes(actual.tints, next.tints)) return;
  editor.view.dispatch(editor.state.tr.setMeta(anchorPaintKey, next));
}
