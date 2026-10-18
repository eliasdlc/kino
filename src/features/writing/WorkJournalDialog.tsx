"use client";

import { CheckCircle2, Flame, Lightbulb, Target } from "lucide-react";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useWorkJournal } from "./writing.hooks";
import { milestoneLabel } from "./writing.streak";
import type { JournalDay, WorkMilestone } from "./writing.types";

const DAY_FORMAT = new Intl.DateTimeFormat("es", {
  weekday: "long",
  day: "numeric",
  month: "long",
  // La fecha se construye en UTC: formatearla en la zona del navegador la
  // corría un día hacia atrás al oeste de Greenwich.
  timeZone: "UTC",
});

/** `yyyy-MM-dd` → "lunes, 13 de julio". Se formatea en UTC: es una fecha pura. */
function formatDay(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  return DAY_FORMAT.format(new Date(Date.UTC(y!, (m ?? 1) - 1, d ?? 1)));
}

function formatMinutes(minutes: number): string {
  if (minutes < 1) return "menos de un minuto";
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest > 0 ? `${h} h ${rest} min` : `${h} h`;
}

function MilestoneIcon({ milestone }: { milestone: WorkMilestone }) {
  // Terminar un capítulo es un hecho cumplido y va en --ok; los demás hitos
  // son notas al margen del día, en tinta apagada. El ámbar se queda para la
  // acción primaria.
  if (milestone.kind === "chapter-completed") {
    return <CheckCircle2 aria-hidden className="size-4 shrink-0 text-ok" />;
  }
  const className = "size-4 shrink-0 text-muted-foreground";
  if (milestone.kind === "goal-reached") return <Target aria-hidden className={className} />;
  if (milestone.kind === "breakthrough") return <Lightbulb aria-hidden className={className} />;
  return <Flame aria-hidden className={className} />;
}

/**
 * Un día del diario como fila de margen: el número del día en el margen, en
 * display y `--mute`; el día en palabras como título; debajo, lo escrito, los
 * capítulos tocados y los hitos. Sin caja ni línea de tiempo dibujada: el
 * hairline separa los días.
 */
function JournalDayRow({ entry }: { entry: JournalDay }) {
  const chapters = [...new Set(entry.sessions.map((s) => s.pageTitle?.trim() || "Sin título"))];
  const dia = Number(entry.day.slice(8, 10));

  return (
    <li
      data-slot="journal-day"
      className="grid grid-cols-[var(--margen)_1fr] border-b border-border py-3 last:border-b-0"
    >
      <span
        aria-hidden
        className="pt-0.5 text-center font-display text-lg leading-tight font-bold text-muted-foreground tabular-nums"
      >
        {dia}
      </span>
      <div className="min-w-0">
        <p className="text-base font-semibold first-letter:uppercase text-foreground">{formatDay(entry.day)}</p>

        {entry.sessions.length > 0 && (
          <p className="text-sm text-muted-foreground tabular-nums">
            {entry.words >= 0 ? "+" : ""}
            {entry.words.toLocaleString("es")} palabras
            {entry.minutes > 0 ? `, ${formatMinutes(entry.minutes)}` : ""}
            {`, ${entry.cumulativeWords.toLocaleString("es")} acumuladas`}
          </p>
        )}

        {chapters.length > 0 && (
          <p className="truncate font-serif text-sm text-body">{chapters.join(", ")}</p>
        )}

        {entry.milestones.length > 0 && (
          <ul className="mt-1.5 space-y-1">
            {entry.milestones.map((milestone, i) => (
              <li key={i} className="flex items-center gap-2 text-sm text-foreground">
                <MilestoneIcon milestone={milestone} />
                {milestoneLabel(milestone)}
              </li>
            ))}
          </ul>
        )}
      </div>
    </li>
  );
}

/**
 * Diario de la obra (PLAN-11 §9): el histórico de sesiones e hitos. Nada de esto
 * se guarda como evento: se reconstruye de las sesiones y de los capítulos
 * terminados, así que también existe para el pasado que aún no se registraba.
 */
export function WorkJournalDialog({
  folderId,
  folderName,
  open,
  onOpenChange,
}: {
  folderId: string | null;
  folderName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: journal, isLoading } = useWorkJournal(open ? folderId : null);

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="max-h-[85dvh] max-w-lg overflow-y-auto">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Diario de {folderName}</ResponsiveDialogTitle>
        </ResponsiveDialogHeader>

        {isLoading && (
          <div className="space-y-3 py-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        )}

        {journal && journal.days.length === 0 && (
          <EmptyState
            title="Nada que releer todavía"
            description="Escribe un rato y este diario se irá llenando solo."
          />
        )}

        {journal && journal.days.length > 0 && (
          <>
            <p className="text-sm text-muted-foreground tabular-nums">
              {journal.totalWords.toLocaleString("es")} palabras
              {journal.wordGoal ? ` de ${journal.wordGoal.toLocaleString("es")}` : ""}
              {`, ${journal.days.length} ${journal.days.length === 1 ? "día" : "días"} con actividad`}
            </p>
            <ul className="mt-2 border-t border-border">
              {journal.days.map((entry) => (
                <JournalDayRow key={entry.day} entry={entry} />
              ))}
            </ul>
          </>
        )}
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
