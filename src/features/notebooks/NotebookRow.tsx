"use client";

import { useState } from "react";
import Link from "next/link";
import { Pencil, Trash2 } from "lucide-react";
import { MarginRow } from "@/components/ui/margin-row";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useDeletePage, useUpdatePage } from "@/features/pages/pages.hooks";
import type { PageListItemTransport } from "@/features/pages/pages.types";
import { useRowManifest } from "@/features/systems/systems.hooks";
import type { ArchetypeManifest } from "@/shared/lib/system-types";
import { cn } from "@/lib/utils";
import { formatCount, joinMeta, relativeDay } from "./index-format";
import { RenameDialog } from "./RenameDialog";
import { RowActions } from "./RowActions";

export interface NotebookRowProps {
  page: PageListItemTransport;
  systemId: string;
  /** Posición en su índice, desde 1: el número del margen. */
  index: number;
  href: string;
  /** Cuándo se tocó, para que la fecha relativa no dependa del reloj del test. */
  now?: Date;
  /** El vocabulario del sistema, que la lista ya tiene: así la fila no se suscribe a los sistemas. */
  manifest?: ArchetypeManifest;
  className?: string;
}

/**
 * Un documento (manuscrito, apunte, nota) como fila numerada: el número en el
 * margen, el título en Literata porque es un texto y no un control, la meta en
 * mute (cuándo, sus etiquetas, si está terminado) y la cifra de palabras a la
 * derecha. Sin vista previa ni chips de etiqueta: la etiqueta entra en la meta.
 */
export function NotebookRow({ page, systemId, index, href, now, manifest: manifestProp, className }: NotebookRowProps) {
  const manifest = useRowManifest(systemId, manifestProp);
  const noun = manifest.pageRole.noun;
  const { mutate: deletePage } = useDeletePage(systemId);
  const { mutate: updatePage, isPending: renaming } = useUpdatePage(page.id, systemId);
  const [renameOpen, setRenameOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const title = page.title?.trim() || "Sin título";
  const terminado = Boolean(page.completedAt);

  const meta = joinMeta([
    relativeDay(page.updatedAt, now),
    ...page.tags.map((tag) => tag.title),
  ]);

  return (
    <>
      <MarginRow
        data-notebook-row=""
        margin={
          <span aria-hidden className="mt-[0.55rem] block text-base leading-none font-bold tabular-nums">
            {index}
          </span>
        }
        trailing={
          <span className="flex items-center gap-1">
            <span className="flex flex-col items-end leading-tight">
              <span className="font-semibold text-foreground">{formatCount(page.wordCount)}</span>
              <span className="text-xs">{page.wordCount === 1 ? "palabra" : "palabras"}</span>
            </span>
            <RowActions
              subject={title}
              actions={[
                { label: "Renombrar", icon: Pencil, onSelect: () => setRenameOpen(true) },
                { label: "Eliminar", icon: Trash2, destructive: true, onSelect: () => setConfirmDelete(true) },
              ]}
            />
          </span>
        }
        className={cn("group relative has-[a:hover]:bg-sf2/60", className)}
      >
        <Link
          href={href}
          className={cn(
            "line-clamp-2 rounded-sm font-serif text-[1.06rem] leading-snug text-foreground focus-ring after:absolute after:inset-0 after:content-['']",
            !page.title?.trim() && "text-muted-foreground italic",
          )}
        >
          {title}
        </Link>
        {(meta || terminado) && (
          <span className="line-clamp-2 text-sm text-muted-foreground">
            {terminado && <span className="font-semibold text-ok">terminado</span>}
            {terminado && meta && ", "}
            {meta}
          </span>
        )}
      </MarginRow>

      <RenameDialog
        open={renameOpen}
        onOpenChange={setRenameOpen}
        title={`Renombrar ${noun}`}
        fieldLabel="Título"
        current={page.title ?? ""}
        maxLength={500}
        saving={renaming}
        onSave={(next) => updatePage({ title: next }, { onSuccess: () => setRenameOpen(false) })}
      />
      <ConfirmDialog
        open={confirmDelete}
        title={`Eliminar ${noun}`}
        description={`"${title}" se eliminará.`}
        onConfirm={() => {
          setConfirmDelete(false);
          deletePage(page.id);
        }}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  );
}
