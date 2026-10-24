import { Extension } from "@tiptap/react";
import type { Editor } from "@tiptap/react";
import type { EditorState, Transaction } from "@tiptap/pm/state";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { docText, locateInDoc, type DocRange } from "./review-locate";

/**
 * El resaltado de los comentarios de revisión dentro del editor.
 *
 * Va por decoración y no por marca, al revés que la nota adhesiva, y a
 * propósito: el comentario lo escribe el agente, y una marca sería el agente
 * escribiendo en el HTML de la persona. La decoración no se guarda, no viaja
 * en el export y no cuenta para el tope del contenido.
 *
 * Cada cita se busca una vez, cuando su comentario llega. Desde ahí su rango
 * viaja con cada transacción, como viaja un cursor: si la persona escribe
 * dentro del fragmento, el resaltado la sigue mientras reescribe. Un rango que
 * se queda vacío es un fragmento borrado, y su comentario pasa a la lista de
 * los que ya no encuentran su texto en vez de desaparecer.
 */

/** Lo que el editor necesita saber de un comentario para pintarlo. */
export interface HighlightComment {
  id: string;
  quote: string;
  prefix: string | null;
  suffix: string | null;
  /** El peso del subrayado. Una pregunta de la persona no lleva severidad. */
  severity: "critical" | "important" | "suggestion" | null;
}

interface TrackedRange extends DocRange {
  severity: HighlightComment["severity"];
}

interface HighlightState {
  ranges: ReadonlyMap<string, TrackedRange>;
  active: string | null;
  decorations: DecorationSet;
}

type Meta = { comments?: readonly HighlightComment[]; active?: string | null };

export const reviewHighlightKey = new PluginKey<HighlightState>("reviewHighlight");

/** El evento con el que el editor avisa de que se pulsó un fragmento comentado. */
export const REVIEW_SELECT_EVENT = "kino:review-select";

function pintar(state: EditorState["doc"], ranges: ReadonlyMap<string, TrackedRange>, active: string | null) {
  const decorations: Decoration[] = [];
  for (const [id, range] of ranges) {
    const clases = ["review-anchor", `review-anchor-${range.severity ?? "question"}`];
    if (id === active) clases.push("review-anchor-active");
    decorations.push(Decoration.inline(range.from, range.to, { class: clases.join(" "), "data-review-id": id }));
  }
  return DecorationSet.create(state, decorations);
}

function aplicar(tr: Transaction, prev: HighlightState, newState: EditorState): HighlightState {
  const meta = tr.getMeta(reviewHighlightKey) as Meta | undefined;
  let ranges = prev.ranges;
  let cambio = false;

  if (tr.docChanged) {
    const mapped = new Map<string, TrackedRange>();
    for (const [id, range] of ranges) {
      const from = tr.mapping.map(range.from, 1);
      const to = tr.mapping.map(range.to, -1);
      if (from < to) mapped.set(id, { ...range, from, to });
    }
    ranges = mapped;
    cambio = true;
  }

  if (meta?.comments) {
    // Lo que ya se seguía se queda donde lo dejó la edición; sólo se busca lo nuevo.
    const next = new Map<string, TrackedRange>();
    let projection: ReturnType<typeof docText> | null = null;
    for (const comment of meta.comments) {
      const tracked = ranges.get(comment.id);
      if (tracked) {
        next.set(comment.id, { ...tracked, severity: comment.severity });
        continue;
      }
      // Esta misma transacción acaba de borrar su fragmento: no se busca otro igual.
      if (tr.docChanged && prev.ranges.has(comment.id)) continue;
      projection ??= docText(newState.doc);
      const found = locateInDoc(projection, { exact: comment.quote, prefix: comment.prefix, suffix: comment.suffix });
      if (found) next.set(comment.id, { ...found, severity: comment.severity });
    }
    ranges = next;
    cambio = true;
  }

  const active = meta && "active" in meta ? (meta.active ?? null) : prev.active;
  if (active !== prev.active) cambio = true;
  if (!cambio) return prev;
  return { ranges, active, decorations: pintar(newState.doc, ranges, active) };
}

export const ReviewHighlight = Extension.create({
  name: "reviewHighlight",

  addProseMirrorPlugins() {
    return [
      new Plugin<HighlightState>({
        key: reviewHighlightKey,
        state: {
          init: () => ({ ranges: new Map(), active: null, decorations: DecorationSet.empty }),
          apply: aplicar,
        },
        props: {
          decorations: (state) => reviewHighlightKey.getState(state)?.decorations ?? DecorationSet.empty,
          handleDOMEvents: {
            click: (view, event) => {
              const target = event.target instanceof Element ? event.target.closest("[data-review-id]") : null;
              const id = target?.getAttribute("data-review-id");
              if (!id) return false;
              view.dom.dispatchEvent(new CustomEvent(REVIEW_SELECT_EVENT, { detail: id, bubbles: true }));
              return false;
            },
          },
        },
      }),
    ];
  },
});

/** Le da al editor la lista de comentarios que pinta. */
export function setHighlightComments(editor: Editor, comments: readonly HighlightComment[]) {
  editor.view.dispatch(editor.state.tr.setMeta(reviewHighlightKey, { comments } satisfies Meta).setMeta("addToHistory", false));
}

/** Enciende un comentario, o ninguno. */
export function setHighlightActive(editor: Editor, active: string | null) {
  editor.view.dispatch(editor.state.tr.setMeta(reviewHighlightKey, { active } satisfies Meta).setMeta("addToHistory", false));
}

/** Dónde está ahora cada fragmento comentado que el editor sigue. */
export function highlightRanges(state: EditorState): ReadonlyMap<string, DocRange> {
  return reviewHighlightKey.getState(state)?.ranges ?? new Map();
}
