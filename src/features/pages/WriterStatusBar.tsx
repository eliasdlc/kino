"use client";

import { useEffect, useRef } from "react";
import { Flame, Focus, Minimize2, Scroll, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSharedEditor } from "./EditorContext";
import { useWordCount } from "./use-word-count";
import { useWritingOverview } from "@/features/writing/writing.hooks";
import { useCelebrateOnce } from "@/features/writing/celebrate";

export interface WriterObra {
  /** Folder de la obra: ancla las celebraciones a una obra concreta. */
  id: string;
  name: string;
  /** Meta de palabras de la obra (folders.metadata.wordGoal), o null si no tiene. */
  wordGoal: number | null;
  /** Palabras de la obra SIN contar el capítulo abierto: el capítulo se cuenta en vivo. */
  wordsExcludingCurrent: number;
}

/** Rachas que merecen celebración: mismas que marca el diario de la obra. */
const STREAK_MILESTONES = [7, 30, 100, 365];

/**
 * Status bar del arquetipo Writing (PLAN-11 §7): palabras del capítulo en vivo,
 * progreso de la obra contra su meta y racha. El conteo se deriva del contenido
 * Tiptap: nunca un contador persistido (D12: derivar > mantener).
 *
 * Es un grupo con nombre y no una región viva: la cifra cambia en cada pausa
 * de tecleo y un lector de pantalla no tiene por qué repetir la barra entera.
 * La racha que ya cuenta hoy va en --ok y el progreso de la obra en tinta: el
 * ámbar se queda para la acción. «Papel cálido» y «Enfoque» son interruptores
 * con borde cuando están apagados y tinta llena cuando están puestos.
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
  // Una sola cuenta por pausa, compartida con quien la necesite.
  const chapterWords = useWordCount(editor);
  const { data: overview } = useWritingOverview(systemId);
  const celebrateOnce = useCelebrateOnce();

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
    // que lleva (recuento y modo enfoque) se consulta entre frases, no mientras
    // se teclea, así que baja con el texto y deja de competir; escribiendo, lo
    // que se toca es la barra del pulgar. Papel con hairline, sin vidrio.
    <div
      role="group"
      aria-label="Estado del capítulo"
      className="z-(--z-raised) flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border bg-background px-4 py-1 text-sm text-muted-foreground md:sticky md:bottom-0 md:flex-nowrap md:px-6"
    >
      <span className="tabular-nums">
        <span className="font-semibold text-foreground">{chapterWords.toLocaleString("es")}</span> palabras en el capítulo
      </span>

      {obra && !focusMode && (
        <div className="flex w-full min-w-0 items-center gap-2 md:w-auto md:flex-1">
          <span className="shrink-0 truncate tabular-nums">
            {obra.name}: {obraWords!.toLocaleString("es")}
            {goal ? ` de ${goal.toLocaleString("es")}` : ""}
          </span>
          {pct != null && (
            // La barra crece en transform, nunca en ancho: escala desde la
            // izquierda y no mueve nada a su alrededor.
            <div
              role="progressbar"
              aria-label="Progreso de la obra"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
              className="h-1 w-24 shrink-0 overflow-hidden rounded-full bg-secondary"
            >
              <div
                data-slot="progreso"
                className="h-full w-full origin-left rounded-full bg-foreground transition-transform duration-(--dur-cuenta) ease-(--ease-pluma)"
                style={{ transform: `scaleX(${pct / 100})` }}
              />
            </div>
          )}
        </div>
      )}

      {overview && overview.streakDays > 0 && !focusMode && (
        <span
          className="flex shrink-0 items-center gap-1 tabular-nums"
          title={
            overview.streakIncludesToday
              ? "Tu racha ya cuenta hoy"
              : "Tu racha sigue viva: escribe hoy para no perderla"
          }
        >
          <Flame
            aria-hidden
            className={cn(
              "size-3.5",
              overview.streakIncludesToday ? "text-ok" : "text-muted-foreground",
            )}
          />
          {overview.streakDays === 1 ? "1 día" : `${overview.streakDays} días`}
        </span>
      )}

      <div className="ml-auto flex shrink-0 items-center gap-1">
        {!focusMode && (
          <button
            type="button"
            onClick={onTogglePaper}
            aria-pressed={paper}
            className={BOTON}
            title="Escribir sobre papel cálido"
          >
            <Scroll aria-hidden className="size-4" />
            Papel cálido
          </button>
        )}
        {onToggleFocus && (
          <button
            type="button"
            onClick={onToggleFocus}
            aria-pressed={focusMode}
            className={BOTON}
            title={focusMode ? "Salir del enfoque (Esc)" : "Atenuar todo menos el párrafo que escribes"}
          >
            {focusMode ? <Minimize2 aria-hidden className="size-4" /> : <Focus aria-hidden className="size-4" />}
            {focusMode ? "Salir" : "Enfoque"}
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Los dos interruptores de la barra: borde cuando están apagados, tinta llena
 * cuando están puestos, 48 px en un dedo.
 */
const BOTON =
  "flex h-9 items-center gap-1.5 rounded-full border border-input px-3 text-sm font-medium transition-[color,background-color,border-color] duration-(--dur-toque) ease-(--ease-pluma) focus-ring hover:text-foreground aria-pressed:border-foreground aria-pressed:bg-foreground aria-pressed:text-background pointer-coarse:h-[2.85rem]";
