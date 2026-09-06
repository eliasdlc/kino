"use client";

import Link from "next/link";
import { useFolders, useUpdateFolder } from "@/features/folders/folders.hooks";
import { usePages, useCreatePage } from "@/features/pages/pages.hooks";
import { NewFolderInline } from "@/features/folders/NewFolderInline";
import { SYSTEM_TYPE_CONFIG } from "@/shared/lib/system-types";
import {
  MEDIUM_CONFIG,
  MEDIUM_OPTIONS,
  resolveMedium,
  type MediumId,
} from "@/shared/lib/mediums";
import { WritingPulse } from "@/features/writing/WritingPulse";
import { WorkJournalDialog } from "@/features/writing/WorkJournalDialog";
import { useWritingOverview } from "@/features/writing/writing.hooks";
import { CompileMenu } from "@/features/writing/CompileMenu";
import { useState } from "react";
import {
  BookMarked,
  BookOpen,
  CheckCircle2,
  FileText,
  Feather,
  History,
  Layers,
  Plus,
  Sparkles,
} from "lucide-react";
import type { PageListItemTransport } from "@/features/pages/pages.types";
import type { FolderWithCounts } from "@/features/folders/folders.types";
import type { WorkPulse } from "@/features/writing/writing.types";
import type { SystemViewProps } from "./SystemDetailView";

const folderRole = SYSTEM_TYPE_CONFIG.writing.folderRole!;

function WordProgress({ words, goal }: { words: number; goal: number | null }) {
  if (!goal || goal <= 0) {
    return <span className="font-mono text-xs text-muted-foreground">{words.toLocaleString("es")} palabras</span>;
  }
  const pct = Math.min(100, Math.round((words / goal) * 100));
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
      <span className="shrink-0 font-mono text-xs text-muted-foreground">
        {words.toLocaleString("es")} / {goal.toLocaleString("es")}
      </span>
    </div>
  );
}

function readWordGoal(meta: Record<string, unknown>): number | null {
  if (typeof meta.wordGoal === "number") return meta.wordGoal;
  if (typeof meta.wordGoal === "string") return Number(meta.wordGoal) || null;
  return null;
}

function ObraCard({ obra, manuscripts, systemId, pulse }: {
  obra: FolderWithCounts;
  manuscripts: PageListItemTransport[];
  systemId: string;
  /** Pulso derivado de las sesiones reales; null si la obra nunca tuvo una. */
  pulse: WorkPulse | null;
}) {
  const { mutate: createPage, isPending } = useCreatePage(systemId);
  const { mutate: updateFolder } = useUpdateFolder(systemId);
  const [journalOpen, setJournalOpen] = useState(false);
  const meta = (obra.metadata ?? {}) as Record<string, unknown>;
  // El medium gobierna la estructura del editor (W3): se normaliza al leer, así
  // las obras con el texto libre de W1/W2 ("novela", "guión") siguen funcionando.
  const medium = MEDIUM_CONFIG[resolveMedium(meta)];
  const wordGoal = readWordGoal(meta);
  const totalWords = manuscripts.reduce((sum, p) => sum + p.wordCount, 0);
  // Días sin escribir: se mide contra sesiones reales, no contra `updatedAt` de
  // las pages: renombrar un capítulo no debería resucitar una obra parada.
  const stale = pulse?.daysSinceLastSession ?? null;

  /** Reescribe la metadata con las claves del manifiesto (el legacy `kind` sale). */
  function changeMedium(next: MediumId) {
    const targetDate = typeof meta.targetDate === "string" ? meta.targetDate : null;
    const pinned = Array.isArray(meta.pinnedEntityIds) ? meta.pinnedEntityIds : null;
    updateFolder({
      folderId: obra.id,
      data: {
        metadata: {
          medium: next,
          ...(wordGoal != null ? { wordGoal } : {}),
          ...(targetDate ? { targetDate } : {}),
          ...(pinned ? { pinnedEntityIds: pinned } : {}),
        },
      },
    });
  }

  function addManuscript() {
    const unit = medium.unit.noun;
    createPage({
      folderId: obra.id,
      title: `${unit.charAt(0).toUpperCase()}${unit.slice(1)} ${manuscripts.length + 1}`,
      // Los mediums estructurados nacen con su esqueleto; la prosa, en blanco.
      content: medium.template || undefined,
    });
  }

  return (
    <div className="rounded-xl border bg-muted/20 p-4 space-y-3">
      <div className="flex items-start gap-2">
        <BookMarked size={18} className="mt-0.5 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold truncate">{obra.name}</span>
            <select
              aria-label="Medium de la obra"
              value={medium.id}
              onChange={(e) => changeMedium(e.target.value as MediumId)}
              className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground outline-none transition-colors hover:text-foreground focus:ring-1 focus:ring-primary/40"
            >
              {MEDIUM_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          {stale != null && stale >= 3 && (
            <p className="mt-0.5 text-xs text-amber-500">
              {SYSTEM_TYPE_CONFIG.writing.staleTemplate
                .replace("{nombre}", obra.name)
                .replace("{n}", String(stale))}
            </p>
          )}
        </div>
      </div>

      <WordProgress words={totalWords} goal={wordGoal} />

      <div className="space-y-1">
        {manuscripts.map((m) => (
          <Link
            key={m.id}
            href={`/systems/${systemId}/pages/${m.id}`}
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            {m.completedAt ? (
              <CheckCircle2 size={14} className="shrink-0 text-primary" />
            ) : (
              <FileText size={14} className="shrink-0" />
            )}
            <span className="flex-1 truncate">{m.title || "Sin título"}</span>
            <span className="shrink-0 font-mono text-xs">{m.wordCount.toLocaleString("es")}</span>
          </Link>
        ))}
      </div>

      <div className="flex items-center gap-4">
        <button
          type="button"
          disabled={isPending}
          onClick={addManuscript}
          className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
        >
          <Plus size={15} />
          {medium.unit.newLabel}
        </button>
        <button
          type="button"
          onClick={() => setJournalOpen(true)}
          className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <History size={15} />
          Diario
        </button>
        {manuscripts.length > 0 && (
          <>
            <Link
              href={`/systems/${systemId}/folders/${obra.id}/lectura`}
              className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <BookOpen size={15} />
              Leer
            </Link>
            <Link
              href={`/systems/${systemId}/folders/${obra.id}/tablero`}
              className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <Layers size={15} />
              Tablero
            </Link>
            <CompileMenu folderId={obra.id} systemId={systemId} />
          </>
        )}
      </div>

      <WorkJournalDialog
        folderId={obra.id}
        folderName={obra.name}
        open={journalOpen}
        onOpenChange={setJournalOpen}
      />
    </div>
  );
}

/**
 * Writing. El único arquetipo pages-first: abre en la biblioteca de obras
 * (folders) con sus manuscritos (pages). El progreso de palabras se deriva del
 * contenido Tiptap (nunca un contador persistido). La prueba del manifiesto: un
 * arquetipo radicalmente distinto montado con un manifiesto + esta vista.
 */
export function SystemWritingView({ system }: SystemViewProps) {
  const { data: obras = [] } = useFolders(system.id);
  const { data: pages = [] } = usePages(system.id);
  const { data: overview } = useWritingOverview(system.id);

  // Manuscritos sueltos (sin obra): se muestran aparte para no perderlos.
  const looseManuscripts = pages.filter((p) => !p.folderId);
  const pulseByFolder = new Map((overview?.works ?? []).map((w) => [w.folderId, w]));

  return (
    <div className="space-y-4">
      <WritingPulse systemId={system.id} />

      <div className="flex items-center justify-between gap-3">
        <NewFolderInline
          systemId={system.id}
          label={folderRole.newLabel}
          placeholder={folderRole.placeholder}
          icon={folderRole.icon}
          fields={folderRole.fields}
        />
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href={`/systems/${system.id}/estudio`}
            className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <Sparkles size={15} className="shrink-0" />
            Estudio
          </Link>
          <Link
            href={`/systems/${system.id}/codex`}
            className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <BookOpen size={15} className="shrink-0" />
            Codex
          </Link>
        </div>
      </div>

      {obras.length === 0 && looseManuscripts.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center space-y-2">
          <Feather className="mx-auto size-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            Crea una obra (un libro, un blog, un cómic) y ponle una meta de palabras.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {obras.map((obra) => (
            <ObraCard
              key={obra.id}
              obra={obra}
              manuscripts={pages.filter((p) => p.folderId === obra.id)}
              systemId={system.id}
              pulse={pulseByFolder.get(obra.id) ?? null}
            />
          ))}

          {looseManuscripts.length > 0 && (
            <div className="rounded-xl border bg-muted/10 p-4 space-y-1">
              <p className="mb-2 text-xs text-muted-foreground">Sin obra</p>
              {looseManuscripts.map((m) => (
                <Link
                  key={m.id}
                  href={`/systems/${system.id}/pages/${m.id}`}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <FileText size={14} className="shrink-0" />
                  <span className="flex-1 truncate">{m.title || "Sin título"}</span>
                  <span className="shrink-0 font-mono text-xs">{m.wordCount.toLocaleString("es")}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
