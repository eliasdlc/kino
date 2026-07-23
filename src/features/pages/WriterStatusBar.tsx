"use client";

import { useEffect, useState } from "react";
import { Focus, Minimize2 } from "lucide-react";
import { useSharedEditor } from "./EditorContext";
import { countWords } from "./word-count";

export interface WriterObra {
  name: string;
  /** Meta de palabras de la obra (folders.metadata.wordGoal), o null si no tiene. */
  wordGoal: number | null;
  /** Palabras de la obra SIN contar el capítulo abierto — el capítulo se cuenta en vivo. */
  wordsExcludingCurrent: number;
}

/**
 * Status bar del arquetipo Writing (PLAN-11 §7): palabras del capítulo en vivo y
 * progreso de la obra contra su meta. El conteo se deriva del contenido Tiptap —
 * nunca un contador persistido (D12: derivar > mantener).
 */
export function WriterStatusBar({
  obra,
  paper,
  onTogglePaper,
  focusMode = false,
  onToggleFocus,
}: {
  obra: WriterObra | null;
  paper: boolean;
  onTogglePaper: () => void;
  focusMode?: boolean;
  onToggleFocus?: () => void;
}) {
  const editor = useSharedEditor();
  const [chapterWords, setChapterWords] = useState(0);

  useEffect(() => {
    if (!editor) return;
    const recount = () => setChapterWords(countWords(editor.getHTML()));
    recount();
    editor.on("update", recount);
    return () => {
      editor.off("update", recount);
    };
  }, [editor]);

  const obraWords = obra ? obra.wordsExcludingCurrent + chapterWords : null;
  const goal = obra?.wordGoal ?? null;
  const pct =
    obraWords != null && goal && goal > 0
      ? Math.min(100, Math.round((obraWords / goal) * 100))
      : null;

  return (
    <div className="sticky bottom-0 z-10 flex items-center gap-4 border-t bg-background/80 px-4 py-1.5 text-xs text-muted-foreground backdrop-blur md:px-6">
      <span className="font-mono">
        Cap: <span className="text-foreground">{chapterWords.toLocaleString("es")}</span> palabras
      </span>

      {obra && !focusMode && (
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="shrink-0 truncate font-mono">
            {obra.name}: {obraWords!.toLocaleString("es")}
            {goal ? ` / ${goal.toLocaleString("es")}` : ""}
          </span>
          {pct != null && (
            <div className="h-1 w-24 shrink-0 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
          )}
        </div>
      )}

      <div className="ml-auto flex shrink-0 items-center gap-1">
        {!focusMode && (
          <button
            type="button"
            onClick={onTogglePaper}
            className="rounded px-1.5 py-0.5 transition-colors hover:text-foreground"
            title="Alternar fondo papel"
          >
            {paper ? "Papel" : "Oscuro"}
          </button>
        )}
        {onToggleFocus && (
          <button
            type="button"
            onClick={onToggleFocus}
            className="flex items-center gap-1 rounded px-1.5 py-0.5 transition-colors hover:text-foreground"
            title={focusMode ? "Salir de focus (Esc)" : "Modo focus"}
          >
            {focusMode ? <Minimize2 className="size-3.5" /> : <Focus className="size-3.5" />}
            {focusMode ? "Salir" : "Focus"}
          </button>
        )}
      </div>
    </div>
  );
}
