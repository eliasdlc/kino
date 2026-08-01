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
import { differenceInCalendarDays } from "date-fns";
import { BookMarked, BookOpen, FileText, Feather, Plus, Sparkles } from "lucide-react";
import type { PageListItem } from "@/features/pages/pages.types";
import type { FolderWithCounts } from "@/features/folders/folders.types";
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

/** Días desde la última sesión = manuscrito de la obra actualizado más recientemente. */
function daysSinceLastSession(manuscripts: PageListItem[]): number | null {
  if (manuscripts.length === 0) return null;
  const latest = manuscripts.reduce((max, p) => {
    const ms = new Date(p.updatedAt).getTime();
    return ms > max ? ms : max;
  }, 0);
  return differenceInCalendarDays(new Date(), new Date(latest));
}

function readWordGoal(meta: Record<string, unknown>): number | null {
  if (typeof meta.wordGoal === "number") return meta.wordGoal;
  if (typeof meta.wordGoal === "string") return Number(meta.wordGoal) || null;
  return null;
}

function ObraCard({ obra, manuscripts, systemId }: {
  obra: FolderWithCounts;
  manuscripts: PageListItem[];
  systemId: string;
}) {
  const { mutate: createPage, isPending } = useCreatePage(systemId);
  const { mutate: updateFolder } = useUpdateFolder(systemId);
  const meta = (obra.metadata ?? {}) as Record<string, unknown>;
  // El medium gobierna la estructura del editor (W3): se normaliza al leer, así
  // las obras con el texto libre de W1/W2 ("novela", "guión") siguen funcionando.
  const medium = MEDIUM_CONFIG[resolveMedium(meta)];
  const wordGoal = readWordGoal(meta);
  const totalWords = manuscripts.reduce((sum, p) => sum + p.wordCount, 0);
  const stale = daysSinceLastSession(manuscripts);

  /** Reescribe la metadata con las claves del manifiesto (el legacy `kind` sale). */
  function changeMedium(next: MediumId) {
    const targetDate = typeof meta.targetDate === "string" ? meta.targetDate : null;
    updateFolder({
      folderId: obra.id,
      data: {
        metadata: {
          medium: next,
          ...(wordGoal != null ? { wordGoal } : {}),
          ...(targetDate ? { targetDate } : {}),
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
            <FileText size={14} className="shrink-0" />
            <span className="flex-1 truncate">{m.title || "Sin título"}</span>
            <span className="shrink-0 font-mono text-xs">{m.wordCount.toLocaleString("es")}</span>
          </Link>
        ))}
      </div>

      <button
        type="button"
        disabled={isPending}
        onClick={addManuscript}
        className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
      >
        <Plus size={15} />
        {medium.unit.newLabel}
      </button>
    </div>
  );
}

/**
 * Writing — el único arquetipo pages-first: abre en la biblioteca de obras
 * (folders) con sus manuscritos (pages). El progreso de palabras se deriva del
 * contenido Tiptap (nunca un contador persistido). La prueba del manifiesto: un
 * arquetipo radicalmente distinto montado con un manifiesto + esta vista.
 */
export function SystemWritingView({ system }: SystemViewProps) {
  const { data: obras = [] } = useFolders(system.id);
  const { data: pages = [] } = usePages(system.id);

  // Manuscritos sueltos (sin obra) — se muestran aparte para no perderlos.
  const looseManuscripts = pages.filter((p) => !p.folderId);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-muted-foreground">
        <Sparkles size={15} className="shrink-0 text-primary" />
        <span>Escribí en tu mejor ventana creativa — tu pico de energía. Kino la conoce.</span>
      </div>

      <div className="flex items-center justify-between gap-3">
        <NewFolderInline
          systemId={system.id}
          label={folderRole.newLabel}
          placeholder={folderRole.placeholder}
          icon={folderRole.icon}
          fields={folderRole.fields}
        />
        <Link
          href={`/systems/${system.id}/codex`}
          className="flex shrink-0 items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <BookOpen size={15} className="shrink-0" />
          Codex
        </Link>
      </div>

      {obras.length === 0 && looseManuscripts.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center space-y-2">
          <Feather className="mx-auto size-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            Crea una obra —un libro, un blog, un cómic— y ponle una meta de palabras.
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
