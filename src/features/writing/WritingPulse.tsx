"use client";

import { useState } from "react";
import { Flame, PencilLine, Sunrise, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import { MarginRow } from "@/components/ui/margin-row";
import { useUpdateSystem } from "@/features/systems/systems.hooks";
import { useWritingOverview } from "./writing.hooks";
import type { WritingOverview } from "./writing.types";

/** "de 09 a 11 h" a partir de la ventana aprendida, en horas locales. */
export function formatWindow(peak: { start: number; end: number }): string {
  const hour = (h: number) => `${h % 24}`.padStart(2, "0");
  return `de ${hour(peak.start)} a ${hour(peak.end)} h`;
}

function isWithinWindow(peak: { start: number; end: number }, hour: number): boolean {
  // La ventana puede cruzar medianoche (de 22 a 02) en cronotipos nocturnos.
  return peak.start <= peak.end
    ? hour >= peak.start && hour < peak.end
    : hour >= peak.start || hour < peak.end;
}

/**
 * El advisor de ventana creativa (PLAN-11 §9). Mientras Kino no tenga curva
 * aprendida no inventa una hora: dice qué le falta. Prometer "tu mejor ventana
 * es de 9 a 11" sin datos es exactamente el tipo de consejo que se deja de leer.
 */
export function advisorText(overview: WritingOverview): string {
  if (!overview.peakWindow) {
    return "Tu ventana creativa todavía no tiene datos suficientes: registra tu energía unos días y aparecerá aquí.";
  }
  const window = formatWindow(overview.peakWindow);
  return isWithinWindow(overview.peakWindow, overview.currentHour)
    ? `Tu ventana creativa es ahora, ${window}. Es el momento de escribir.`
    : `Tu mejor ventana creativa es ${window}.`;
}

function Streak({ overview }: { overview: WritingOverview }) {
  if (overview.streakDays === 0) return null;
  const label = overview.streakDays === 1 ? "1 día" : `${overview.streakDays} días`;
  return (
    <span
      className="inline-flex h-9 shrink-0 items-center gap-1.5 text-sm text-muted-foreground tabular-nums"
      title={
        overview.streakIncludesToday
          ? "Tu racha ya cuenta hoy"
          : "Tu racha sigue viva: escribe hoy para no perderla"
      }
    >
      <Flame
        aria-hidden
        // Hoy ya cuenta: es un estado cumplido, en --ok. El ámbar es de la acción.
        className={cn("size-4", overview.streakIncludesToday ? "text-ok" : "text-muted-foreground")}
      />
      {label} de racha
    </span>
  );
}

function DailyGoal({
  systemId,
  overview,
}: {
  systemId: string;
  overview: WritingOverview;
}) {
  const { mutate: updateSystem } = useUpdateSystem();
  // `null` = no se está editando. El borrador se siembra al abrir el input, así
  // que no hace falta un efecto que lo sincronice con la meta del server.
  const [draft, setDraft] = useState<string | null>(null);

  function save(value: string) {
    setDraft(null);
    const parsed = Number(value.trim());
    const next = Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : 0;
    if (next === (overview.dailyWordGoal ?? 0)) return;
    updateSystem({ systemId, data: { metadata: { dailyWordGoal: next } } });
  }

  if (draft !== null) {
    return (
      <input
        autoFocus
        type="number"
        inputMode="numeric"
        min={0}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => save(draft)}
        onKeyDown={(e) => {
          if (e.key === "Enter") save(draft);
          if (e.key === "Escape") setDraft(null);
        }}
        placeholder="500"
        aria-label="Meta diaria de palabras"
        className="h-[2.85rem] w-28 rounded-full border border-border bg-background px-4 text-sm tabular-nums outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      />
    );
  }

  const goal = overview.dailyWordGoal;
  const pct = goal ? Math.min(100, Math.round((overview.wordsToday / goal) * 100)) : null;

  return (
    <button
      type="button"
      onClick={() => setDraft(String(goal ?? ""))}
      className="press inline-flex h-[2.85rem] shrink-0 items-center gap-2 rounded-full px-3 text-sm text-muted-foreground transition-[color,background-color,transform] duration-(--dur-toque) ease-(--ease-pluma) focus-ring hover:bg-secondary hover:text-foreground"
      title={goal ? "Cambiar la meta diaria de palabras" : "Ponerte una meta diaria de palabras"}
    >
      {goal ? <Target aria-hidden className="size-4" /> : <PencilLine aria-hidden className="size-4" />}
      <span className="tabular-nums">
        {goal
          ? `${overview.wordsToday.toLocaleString("es")} de ${goal.toLocaleString("es")} hoy`
          : `${overview.wordsToday.toLocaleString("es")} hoy, sin meta`}
      </span>
      {pct != null && (
        // Crece en transform desde la izquierda, nunca en ancho.
        <span aria-hidden className="h-1 w-12 overflow-hidden rounded-full bg-secondary">
          <span
            className="block h-full w-full origin-left rounded-full bg-foreground transition-transform duration-(--dur-cuenta) ease-(--ease-pluma)"
            style={{ transform: `scaleX(${pct / 100})` }}
          />
        </span>
      )}
    </button>
  );
}

/**
 * Cabecera de motivación del sistema writing: ventana creativa, racha y meta
 * diaria. Sustituye al aviso estático de W1 por lo que Kino de verdad sabe.
 *
 * Una fila de Diario y no un recuadro teñido: el amanecer en el margen, el
 * consejo en la voz (Literata en cursiva) y debajo la racha y la meta, que se
 * toca para cambiarla. El ámbar no tiñe el bloque: la llama se enciende en
 * --ok cuando la racha ya cuenta hoy y la barra de la meta va en tinta.
 *
 * La fila de la racha y la meta se reserva desde la primera pintura con el alto
 * del botón de la meta (2.85rem): cuando llegan los datos no empuja la
 * biblioteca que va debajo.
 */
export function WritingPulse({ systemId }: { systemId: string }) {
  const { data: overview } = useWritingOverview(systemId);

  return (
    <MarginRow
      data-slot="writing-pulse"
      margin={<Sunrise aria-hidden className="size-5" />}
      className="border-b-0"
    >
      <span className="block font-voice text-base italic leading-snug text-body">
        {overview ? advisorText(overview) : "Escribe en tu mejor ventana creativa: tu pico de energía."}
      </span>
      {overview ? (
        // -ml-3 alinea el lápiz de la meta (px-3) con la columna de texto; la
        // racha, cuando existe, recupera esos 0.75rem con su propio pl-3.
        <span data-slot="writing-pulse-meta" className="mt-1 flex min-h-[2.85rem] flex-wrap items-center gap-x-3 -ml-3">
          {overview.streakDays > 0 && (
            <span className="pl-3">
              <Streak overview={overview} />
            </span>
          )}
          <DailyGoal systemId={systemId} overview={overview} />
        </span>
      ) : (
        <span aria-hidden data-slot="writing-pulse-meta" className="mt-1 block h-[2.85rem]" />
      )}
    </MarginRow>
  );
}
