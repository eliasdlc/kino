"use client";

import type { Editor } from "@tiptap/react";
import { StickyNote } from "lucide-react";
import { BUBBLE, BUBBLE_BUTTON } from "./bubble-styles";
import { CodexSelectionActions } from "./CodexBubbleMenu";

/**
 * Lo que sale encima de un texto marcado: pegarle una nota adhesiva y, en una
 * obra, mandarlo al codex. Vive aparte del menú flotante que lo coloca para que
 * el catálogo pinte este mismo componente y no una réplica.
 */
export function SelectionToolbar({
  editor,
  writer,
  systemId,
  onNote,
}: {
  editor: Editor;
  writer: boolean;
  systemId: string;
  onNote: () => void;
}) {
  return (
    <div className={BUBBLE}>
      <button
        type="button"
        onClick={onNote}
        className={BUBBLE_BUTTON}
        title="Pegar una nota adhesiva a lo seleccionado"
      >
        <StickyNote className="size-4" />
        Nota
      </button>
      {writer && <CodexSelectionActions editor={editor} systemId={systemId} />}
    </div>
  );
}
