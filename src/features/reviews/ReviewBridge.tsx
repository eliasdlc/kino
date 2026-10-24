"use client";

import { useEffect, useMemo } from "react";
import type { Editor } from "@tiptap/react";
import { useSharedEditor } from "@/features/pages/EditorContext";
import { scrollBehavior } from "@/shared/utils/motion";
import { useReviewUi, type ReviewAnchors } from "./ReviewContext";
import { usePageReview } from "./reviews.hooks";
import {
  REVIEW_SELECT_EVENT,
  highlightRanges,
  setHighlightActive,
  setHighlightComments,
  type HighlightComment,
} from "./review-highlight.extension";
import { contextAround, rangeSaysQuote } from "./review-locate";
import type { AnchorState, ReviewComment } from "./reviews.types";

/**
 * El puente entre el editor y la revisión: le da al editor los comentarios que
 * pinta, enciende el que está activo, escucha cuando se pulsa un fragmento y le
 * presta al panel tres gestos (ir al fragmento, aplicar una propuesta, leer la
 * selección). Vive dentro del provider del editor, como `AnchorPaint`.
 */
export function ReviewBridge({ pageId }: { pageId: string }) {
  const editor = useSharedEditor();
  const ui = useReviewUi();
  const { data } = usePageReview(pageId);

  const open = useMemo(() => (data?.comments ?? []).filter((c) => c.status === "open"), [data]);
  // La lista cambia de identidad con cada respuesta del servidor; lo que el
  // editor necesita saber sólo cambia cuando cambian estas claves.
  const firma = open.map((c) => `${c.id}:${c.severity ?? ""}`).join("|");

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    const comments: HighlightComment[] = open.map((c) => ({
      id: c.id,
      quote: c.quote,
      prefix: c.prefix,
      suffix: c.suffix,
      severity: c.severity,
    }));
    setHighlightComments(editor, comments);
    // `open` sale de `firma`: depender de la lista repintaría en cada lectura.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, firma]);

  const activeId = ui?.activeId ?? null;
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    setHighlightActive(editor, activeId);
  }, [editor, activeId]);

  // Dónde está cada fragmento ahora mismo. Se publica sólo cuando cambia el
  // orden o el estado, no en cada tecla: escribir encima de un comentario
  // mueve su posición, no su lugar en la lista.
  const setAnchors = ui?.setAnchors;
  useEffect(() => {
    if (!editor || !setAnchors) return;
    let ultima = "";
    const medir = () => {
      const anchors = medirAnclas(editor, open);
      const nueva = anchors.order.map((id) => `${id}:${anchors.states.get(id)}`).join("|") +
        "/" + [...anchors.states].map(([id, s]) => `${id}:${s}`).join("|");
      if (nueva === ultima) return;
      ultima = nueva;
      setAnchors(anchors);
    };
    medir();
    editor.on("transaction", medir);
    return () => {
      editor.off("transaction", medir);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, firma, setAnchors]);

  const setActiveId = ui?.setActiveId;
  const setOpen = ui?.setOpen;
  useEffect(() => {
    if (!editor || !setActiveId || !setOpen) return;
    const dom = editor.view.dom;
    const onSelect = (event: Event) => {
      const id = (event as CustomEvent<string>).detail;
      setActiveId(id);
      setOpen(true);
    };
    dom.addEventListener(REVIEW_SELECT_EVENT, onSelect);
    return () => dom.removeEventListener(REVIEW_SELECT_EVENT, onSelect);
  }, [editor, setActiveId, setOpen]);

  const actions = ui?.editor;
  useEffect(() => {
    if (!editor || !actions) return;
    actions.current = {
      jumpTo: (id) => {
        const range = highlightRanges(editor.state).get(id);
        if (!range) return;
        const dom = editor.view.domAtPos(range.from).node;
        const el = dom instanceof HTMLElement ? dom : dom.parentElement;
        el?.scrollIntoView({ behavior: scrollBehavior(), block: "center" });
      },
      apply: (id, text) => {
        const range = highlightRanges(editor.state).get(id);
        if (!range) return false;
        return editor
          .chain()
          .command(({ tr }) => {
            tr.insertText(text, range.from, range.to);
            return true;
          })
          .run();
      },
      selection: () => {
        const { from, to, empty } = editor.state.selection;
        if (empty) return null;
        const quote = editor.state.doc.textBetween(from, to, " ", " ").trim();
        if (!quote) return null;
        return { quote, ...contextAround(editor.state.doc, { from, to }) };
      },
    };
    return () => {
      actions.current = null;
    };
  }, [editor, actions]);

  return null;
}

function medirAnclas(editor: Editor, comments: readonly ReviewComment[]): ReviewAnchors {
  const ranges = highlightRanges(editor.state);
  const states = new Map<string, AnchorState>();
  const posiciones: [string, number][] = [];
  for (const comment of comments) {
    const range = ranges.get(comment.id);
    if (!range) {
      states.set(comment.id, "missing");
      continue;
    }
    states.set(comment.id, rangeSaysQuote(editor.state.doc, range, comment.quote) ? "here" : "edited");
    posiciones.push([comment.id, range.from]);
  }
  posiciones.sort((a, b) => a[1] - b[1]);
  return { order: posiciones.map(([id]) => id), states };
}
