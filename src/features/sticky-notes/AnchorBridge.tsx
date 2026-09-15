"use client";

import { useEffect } from "react";
import { useSharedEditor } from "@/features/pages/EditorContext";
import { applyAnchorMarkOnText, findAnchorRange } from "./anchor-utils";
import type { StickyNoteItem } from "./sticky-notes.types";

/**
 * Le devuelve el resaltado a la frase de una nota viva que se quedó sin marca.
 *
 * Pasa al restaurar desde la papelera: borrar la nota retiró su marca del
 * documento, así que al volver hay que buscar su frase otra vez. Sólo actúa
 * sobre notas nacidas de una selección, que son las que guardan el texto que
 * anotaron; un ancla de posición no tiene frase que buscar y su nota ya cae
 * sobre `positionY`. Si el texto ya no está en el documento no se escribe
 * nada, que es lo mismo que pasa cuando borras el párrafo que anotaste.
 */
export function AnchorBridge({ notes }: { notes: StickyNoteItem[] }) {
  const editor = useSharedEditor();

  useEffect(() => {
    if (!editor) return;
    for (const note of notes) {
      if (!note.anchorId || !note.textAnchor) continue;
      if (findAnchorRange(editor.state.doc, note.anchorId)) continue;
      applyAnchorMarkOnText(editor, note.textAnchor, note.anchorId);
    }
  }, [editor, notes]);

  return null;
}
