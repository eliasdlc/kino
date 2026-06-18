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
 * Applies a new stickyAnchor mark at `pos`, spanning the inline node starting
 * there (or 1 character as fallback).
 */
export function applyAnchorMarkAtPos(
  editor: Editor,
  pos: number,
  anchorId: string
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

  editor.view.dispatch(tr.addMark(from, to, markType.create({ anchorId })));
}

/**
 * Computes the Y fraction (0-1) of a mark within the container element.
 * Returns null if the mark is not found (orphan).
 */
export function getAnchorYFraction(
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

  const containerRect = container.getBoundingClientRect();
  const containerH = container.offsetHeight;
  if (containerH === 0) return null;

  const relY = coords.top - containerRect.top;
  return Math.max(0, Math.min(1, relY / containerH));
}
