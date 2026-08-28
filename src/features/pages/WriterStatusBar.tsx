"use client";

import { useEffect, useRef, useState } from "react";
import { Flame, Focus, Minimize2, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSharedEditor } from "./EditorContext";
import { countWords } from "@/shared/lib/word-count";
import { useWritingOverview } from "@/features/writing/writing.hooks";
import { useCelebrateOnce } from "@/features/writing/celebrate";

export interface WriterObra {
  /** Folder de la obra — ancla las celebraciones a una obra concreta. */
  id: string;
  name: string;
  /** Meta de palabras de la obra (folders.metadata.wordGoal), o null si no tiene. */
  wordGoal: number | null;
  /** Palabras de la obra SIN contar el capítulo abierto — el capítulo se cuenta en vivo. */
  wordsExcludingCurrent: number;
}

/** Rachas que merecen celebración — mismas que marca el diario de la obra. */
const STREAK_MILESTONES = [7, 30, 100, 365];

/**
 * Status bar del arquetipo Writing (PLAN-11 §7): palabras del capítulo en vivo,
 * progreso de la obra contra su meta y racha. El conteo se deriva del contenido
 * Tiptap — nunca un contador persistido (D12: derivar > mantener).
 */
export function WriterStatusBar({
  obra,
  systemId,
  paper,
  onTogglePaper,
  focusMode = false,
  onToggleFocus,
}: {
  obra: WriterObra | null;
  systemId: string;
  paper: boolean;
  onTogglePaper: () => void;
  focusMode?: boolean;
  onToggleFocus?: () => void;
}) {
  const editor = useSharedEditor();
  const [chapterWords, setChapterWords] = useState(0);
  const { data: overview } = useWritingOverview(systemId);
  const celebrateOnce = useCelebrateOnce();

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

  // Cruzar la meta se celebra en el instante en que pasa, escribiendo. Abrir una
  // obra que ya estaba por encima de su meta no dispara nada: hace falta haberla
  // visto por debajo primero.
  const wasBelowGoal = useRef(false);
  useEffect(() => {
    if (!obra || !goal || goal <= 0 || obraWords == null) return;
    if (obraWords < goal) {
      wasBelowGoal.current = true;
      return;
    }
    if (!wasBelowGoal.current) return;
    wasBelowGoal.current = false;
    celebrateOnce(`goal:${obra.id}:${goal}`, {
      icon: Target,
      title: `Alcanzaste la meta de ${obra.name}`,
      detail: `${goal.toLocaleString("es")} palabras. Lo que sigue ya es ventaja.`,
    });
  }, [obra, goal, obraWords, celebrateOnce]);

  // La racha se celebra en los saltos que se sienten (7, 30, 100, 365 días).
  useEffect(() => {
    if (!overview?.streakIncludesToday) return;
    if (!STREAK_MILESTONES.includes(overview.streakDays)) return;
    celebrateOnce(`streak:${systemId}:${overview.streakDays}`, {
      icon: Flame,
      title: `Racha de ${overview.streakDays} días escribiendo`,
      detail: "Ese hábito es la obra, más que cualquier sesión suelta.",
    });
  }, [overview, systemId, celebrateOnce]);

  return (
    // Pegajosa sólo desde md. En un teléfono `bottom-0` pelea con el teclado
    // virtual: el viewport de layout no encoge al abrirse, así que la barra se
    // queda debajo del teclado o encima de la línea que estás escribiendo. Lo
    // que lleva —recuento y modo focus— se consulta entre frases, no mientras
    // se teclea, así que baja con el texto y deja de competir.
    <div className="z-10 flex items-center gap-4 border-t bg-background/80 px-4 py-1.5 text-xs text-muted-foreground backdrop-blur md:sticky md:bottom-0 md:px-6">
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

      {overview && overview.streakDays > 0 && !focusMode && (
        <span
          className="flex shrink-0 items-center gap-1 font-mono"
          title={
            overview.streakIncludesToday
              ? "Tu racha ya cuenta hoy"
              : "Tu racha sigue viva: escribe hoy para no perderla"
          }
        >
          <Flame
            className={cn(
              "size-3.5",
              overview.streakIncludesToday ? "text-primary" : "text-muted-foreground",
            )}
          />
          {overview.streakDays}
        </span>
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
