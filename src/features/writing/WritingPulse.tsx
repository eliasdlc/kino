"use client";

import { useState } from "react";
import { Flame, PencilLine, Sunrise, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUpdateSystem } from "@/features/systems/systems.hooks";
import { useWritingOverview } from "./writing.hooks";
import type { WritingOverview } from "./writing.types";

/** "9–11" a partir de la ventana aprendida, en horas locales. */
function formatWindow(peak: { start: number; end: number }): string {
  const hour = (h: number) => `${h % 24}`.padStart(2, "0");
  return `${hour(peak.start)}–${hour(peak.end)}h`;
}

function isWithinWindow(peak: { start: number; end: number }, hour: number): boolean {
  // La ventana puede cruzar medianoche (22–02) en cronotipos nocturnos.
  return peak.start <= peak.end
    ? hour >= peak.start && hour < peak.end
    : hour >= peak.start || hour < peak.end;
}

/**
 * El advisor de ventana creativa (PLAN-11 §9). Mientras Kino no tenga curva
 * aprendida no inventa una hora: dice qué le falta. Prometer "tu mejor ventana
 * es 9–11" sin datos es exactamente el tipo de consejo que se deja de leer.
 */
function advisorText(overview: WritingOverview): string {
  if (!overview.peakWindow) {
    return "Tu ventana creativa todavía no tiene datos suficientes: registra tu energía unos días y aparecerá aquí.";
  }
  const window = formatWindow(overview.peakWindow);
  return isWithinWindow(overview.peakWindow, overview.currentHour)
    ? `Tu ventana creativa es ahora (${window}). Es el momento de escribir.`
    : `Tu mejor ventana creativa es ${window}.`;
}

function StreakBadge({ overview }: { overview: WritingOverview }) {
  if (overview.streakDays === 0) return null;
  const label = overview.streakDays === 1 ? "1 día" : `${overview.streakDays} días`;
  return (
    <span
      className="flex shrink-0 items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-xs"
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
      <span className="font-mono">{label}</span>
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
        className="w-20 rounded border border-border bg-muted/60 px-1.5 py-0.5 text-xs outline-none focus:ring-1 focus:ring-primary/40"
      />
    );
  }

  const goal = overview.dailyWordGoal;
  const pct = goal ? Math.min(100, Math.round((overview.wordsToday / goal) * 100)) : null;

  return (
    <button
      type="button"
      onClick={() => setDraft(String(goal ?? ""))}
      className="flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      title="Meta diaria de palabras"
    >
      {goal ? <Target className="size-3.5" /> : <PencilLine className="size-3.5" />}
      <span className="font-mono">
        {overview.wordsToday.toLocaleString("es")}
        {goal ? ` / ${goal.toLocaleString("es")}` : ""} hoy
      </span>
      {pct != null && (
        <span className="h-1 w-12 overflow-hidden rounded-full bg-muted">
          <span
            className="block h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </span>
      )}
    </button>
  );
}

/**
 * Cabecera de motivación del sistema writing: ventana creativa, racha y meta
 * diaria. Sustituye al aviso estático de W1 por lo que Kino de verdad sabe.
 */
export function WritingPulse({ systemId }: { systemId: string }) {
  const { data: overview } = useWritingOverview(systemId);

  if (!overview) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-muted-foreground">
        <Sunrise size={15} className="shrink-0 text-primary" />
        <span>Escribí en tu mejor ventana creativa: tu pico de energía.</span>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-muted-foreground">
      <Sunrise size={15} className="shrink-0 text-primary" />
      <span className="min-w-0 flex-1">{advisorText(overview)}</span>
      <StreakBadge overview={overview} />
      <DailyGoal systemId={systemId} overview={overview} />
    </div>
  );
}
