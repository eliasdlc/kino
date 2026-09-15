import type { Editor } from "@tiptap/react";
import type { Node as PmNode } from "@tiptap/pm/model";

/** Finds the from/to range of a stickyAnchor mark by its anchorId. */
export function findAnchorRange(
  doc: PmNode,
  anchorId: string
): { from: number; to: number } | null {
  let result: { from: number; to: number } | null = null;
  doc.descendants((node, pos) => {
    if (result) return false;
    for (const mark of node.marks) {
      if (mark.type.name === "stickyAnchor" && mark.attrs.anchorId === anchorId) {
        result = { from: pos, to: pos + node.nodeSize };
        return false;
      }
    }
    return undefined;
  });
  return result;
}

/** Removes the stickyAnchor mark with the given anchorId from the document. */
export function removeAnchorMark(editor: Editor, anchorId: string): void {
  const markType = editor.schema.marks.stickyAnchor;
  if (!markType) return;
  const range = findAnchorRange(editor.state.doc, anchorId);
  if (!range) return;
  editor.view.dispatch(
    editor.state.tr.removeMark(range.from, range.to, markType)
  );
}

/**
 * Escribe una marca stickyAnchor en `pos`, sobre el nodo inline que empieza
 * ahi. `muted` la deja sin decoracion: es un ancla de posicion, no una
 * anotacion de ese texto.
 */
export function applyAnchorMarkAtPos(
  editor: Editor,
  pos: number,
  anchorId: string,
  muted = false
): void {
  const { doc, tr, schema } = editor.state;
  const markType = schema.marks.stickyAnchor;
  if (!markType) return;

  const $pos = doc.resolve(pos);
  const nodeAfter = $pos.nodeAfter;
  if (!nodeAfter || nodeAfter.isBlock) return;

  const from = pos;
  const to = Math.min(pos + nodeAfter.nodeSize, $pos.end());
  if (from >= to) return;

  editor.view.dispatch(tr.addMark(from, to, markType.create({ anchorId, muted })));
}

/**
 * A que altura, en pixeles dentro del contenedor, esta el ancla ahora mismo.
 * `null` si la marca ya no existe (el texto que la llevaba se borro).
 *
 * Devuelve pixeles y no una fraccion a proposito. Una fraccion hay que
 * multiplicarla luego por la altura del contenedor, y esas dos alturas no
 * siempre son la misma: la marca se mide cuando el editor avisa de un cambio y
 * la altura del contenedor la trae un ResizeObserver que llega despues, asi que
 * el viaje de ida y vuelta metia un error proporcional al crecimiento del
 * documento. Medido antes de esto: 102 px de desvio al escribir tres parrafos.
 */
export function getAnchorTop(
  editor: Editor,
  anchorId: string,
  container: HTMLElement
): number | null {
  const range = findAnchorRange(editor.state.doc, anchorId);
  if (!range) return null;

  let coords: { top: number };
  try {
    coords = editor.view.coordsAtPos(range.from);
  } catch {
    return null;
  }

  return coords.top - container.getBoundingClientRect().top;
}
