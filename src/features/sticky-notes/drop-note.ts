import type { Editor } from "@tiptap/react";
import {
  applyAnchorMarkAtPos,
  getAnchorTop,
  isAnnotationAnchor,
  removeAnchorMark,
} from "./anchor-utils";
import type { NotebookMetrics } from "./sticky-position";
import type { UpdateStickyNoteInput } from "./sticky-notes.schemas";
import type { StickyNoteItem } from "./sticky-notes.types";

interface DropArgs {
  note: StickyNoteItem;
  editor: Editor | null;
  /** El contenedor del cuaderno, origen de `leftPx` y `topPx`. */
  container: HTMLElement;
  metrics: NotebookMetrics;
  /** La esquina superior izquierda donde quedó la nota, en px del contenedor. */
  leftPx: number;
  topPx: number;
}

/**
 * Lo que se guarda de una nota al soltarla en un punto del cuaderno.
 *
 * Es el mismo cálculo venga la nota de donde venga: de flotar sobre el texto o
 * de la cuadrícula de arriba. La X es una fracción de la columna de texto, así
 * que la nota se mueve con el cuaderno cuando el sidebar lo desplaza. La Y se
 * apunta al párrafo que hay a esa altura, que la hace bajar con el texto cuando
 * escribes por encima, y el desfase la deja exactamente donde la pegaste.
 *
 * Una nota nacida de una frase no se despega de ella: su ancla marca ese texto
 * a propósito, y volver a anclarla le quitaría el resaltado a la frase que se
 * anotó. Lo que cambia al soltarla es cuánto se separa de su frase.
 */
export function dropNote({ note, editor, container, metrics, leftPx, topPx }: DropArgs): UpdateStickyNoteInput {
  const positionX = metrics.columnWidth > 0 ? (leftPx - metrics.columnLeft) / metrics.columnWidth : 0;
  const positionY = metrics.containerH > 0 ? Math.min(1, Math.max(0, topPx / metrics.containerH)) : 0;

  const anota = !!editor && !!note.anchorId && isAnnotationAnchor(editor.state.doc, note.anchorId);

  // El ancla nueva va `muted`: sostiene la nota, no marca ese texto.
  const anchorPos = anota ? null : posAtDrop(editor, container, metrics, topPx);
  let anchorFinal = note.anchorId;
  if (anchorPos !== null && editor) {
    anchorFinal = crypto.randomUUID();
    if (note.anchorId) removeAnchorMark(editor, note.anchorId);
    applyAnchorMarkAtPos(editor, anchorPos, anchorFinal, true);
  }

  // Sin texto bajo el punto de suelta (el hueco del final del documento) la
  // nota conserva el párrafo que ya tenía, y lo que cambia es cuánto se separa
  // de él. Sin esto la nota volvía a su sitio anterior en vertical.
  const anchorTopAhora = anchorFinal && editor ? getAnchorTop(editor, anchorFinal, container) : null;

  return {
    positionSide: "over",
    positionX,
    positionY,
    ...(anchorFinal === note.anchorId ? {} : { anchorId: anchorFinal }),
    ...(anchorTopAhora === null ? {} : { offsetY: topPx - anchorTopAhora }),
  };
}

/** El sitio del documento que queda a la altura del punto donde soltaste. */
function posAtDrop(editor: Editor | null, container: HTMLElement, metrics: NotebookMetrics, topPx: number): number | null {
  if (!editor) return null;
  const rect = container.getBoundingClientRect();
  const textCenterX = rect.left + metrics.columnLeft + metrics.columnWidth / 2;
  const result = editor.view.posAtCoords({ left: textCenterX, top: rect.top + topPx });
  return result ? result.pos : null;
}
