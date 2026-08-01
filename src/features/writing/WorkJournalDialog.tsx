"use client";

import { BookOpenCheck, CheckCircle2, Flame, Lightbulb, Target } from "lucide-react";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useWorkJournal } from "./writing.hooks";
import { milestoneLabel } from "./writing.streak";
import type { JournalDay, WorkMilestone } from "./writing.types";

const DAY_FORMAT = new Intl.DateTimeFormat("es", {
  weekday: "long",
  day: "numeric",
  month: "long",
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
  const className = "size-3.5 shrink-0 text-primary";
  if (milestone.kind === "chapter-completed") return <CheckCircle2 className={className} />;
  if (milestone.kind === "goal-reached") return <Target className={className} />;
  if (milestone.kind === "breakthrough") return <Lightbulb className={className} />;
  return <Flame className={className} />;
}

function JournalDayRow({ entry }: { entry: JournalDay }) {
  const chapters = [...new Set(entry.sessions.map((s) => s.pageTitle?.trim() || "Sin título"))];

  return (
    <li className="border-l border-border/60 pl-4 pb-4 last:pb-0">
      <p className="text-xs font-medium capitalize text-foreground">{formatDay(entry.day)}</p>

      {entry.sessions.length > 0 && (
        <p className="mt-0.5 font-mono text-xs text-muted-foreground">
          {entry.words >= 0 ? "+" : ""}
          {entry.words.toLocaleString("es")} palabras
          {entry.minutes > 0 ? ` · ${formatMinutes(entry.minutes)}` : ""}
          {` · ${entry.cumulativeWords.toLocaleString("es")} acumuladas`}
        </p>
      )}

      {chapters.length > 0 && (
        <p className="mt-0.5 truncate text-xs text-muted-foreground">{chapters.join(" · ")}</p>
      )}

      {entry.milestones.length > 0 && (
        <ul className="mt-1.5 space-y-1">
          {entry.milestones.map((milestone, i) => (
            <li key={i} className="flex items-center gap-1.5 text-xs text-foreground">
              <MilestoneIcon milestone={milestone} />
              {milestoneLabel(milestone)}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

/**
 * Diario de la obra (PLAN-11 §9): el histórico de sesiones e hitos. Nada de esto
 * se guarda como evento — se reconstruye de las sesiones y de los capítulos
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
      <ResponsiveDialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
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
          <div className="rounded-lg border border-dashed p-6 text-center">
            <BookOpenCheck className="mx-auto size-7 text-muted-foreground/40" />
            <p className="mt-2 text-sm text-muted-foreground">
              Todavía no hay nada que releer. Escribe un rato y este diario se irá llenando solo.
            </p>
          </div>
        )}

        {journal && journal.days.length > 0 && (
          <>
            <p className="font-mono text-xs text-muted-foreground">
              {journal.totalWords.toLocaleString("es")} palabras
              {journal.wordGoal ? ` de ${journal.wordGoal.toLocaleString("es")}` : ""}
              {` · ${journal.days.length} ${journal.days.length === 1 ? "día" : "días"} con actividad`}
            </p>
            <ul className="mt-3">
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
