"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { ChevronDown, Pencil, Trash2 } from "lucide-react";
import { MarginRow } from "@/components/ui/margin-row";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useDeleteFolder, useUpdateFolder } from "@/features/folders/folders.hooks";
import type { FolderWithCounts } from "@/features/folders/folders.types";
import { useRowManifest } from "@/features/systems/systems.hooks";
import type { ArchetypeManifest } from "@/shared/lib/system-types";
import { cn } from "@/lib/utils";
import { countNoun, joinMeta, toRoman } from "./index-format";
import { RenameDialog } from "./RenameDialog";
import { RowActions, type RowAction } from "./RowActions";

export interface FolderRowProps {
  folder: FolderWithCounts;
  systemId: string;
  /** Posición en su índice, desde 1: va en el margen como numeral romano. */
  index: number;
  href: string;
  /** Lo que se dice debajo del nombre. Por defecto, lo que contiene. */
  meta?: React.ReactNode;
  /** Una cifra o un estado a la derecha, antes de los controles. */
  trailing?: React.ReactNode;
  /** Operaciones propias del arquetipo (mover a ciclo), antes de eliminar. */
  extraActions?: RowAction[];
  /**
   * Lo que se despliega debajo al plegar y desplegar con el chevron: las hijas,
   * que se sangran sólo por el margen. Sin esto la fila no se pliega.
   */
  children?: React.ReactNode;
  defaultOpen?: boolean;
  /** El vocabulario del sistema, que la lista ya tiene: así la fila no se suscribe a los sistemas. */
  manifest?: ArchetypeManifest;
  className?: string;
}

/**
 * Una carpeta (obra, clase, área) como fila de índice: el numeral romano en
 * el margen, el nombre, lo que contiene dicho con el vocabulario del sistema,
 * y a la derecha el chevron que la pliega y sus operaciones con nombre. Tocar
 * el nombre abre la carpeta; tocar el chevron la despliega aquí mismo.
 *
 * Sustituye a la carpeta de papel con su solapa: aquélla sólo funcionaba con
 * hover, medía cuatro radios distintos y decía "notebooks" en un sistema que
 * no los tiene.
 */
export function FolderRow({
  folder,
  systemId,
  index,
  href,
  meta,
  trailing,
  extraActions = [],
  children,
  defaultOpen = false,
  manifest: manifestProp,
  className,
}: FolderRowProps) {
  const manifest = useRowManifest(systemId, manifestProp);
  const folderRole = manifest.folderRole;
  const noun = folderRole?.noun ?? "carpeta";
  const { mutate: updateFolder, isPending: renaming } = useUpdateFolder(systemId);
  const { mutate: deleteFolder } = useDeleteFolder(systemId);
  const [open, setOpen] = useState(defaultOpen);
  const [renameOpen, setRenameOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const groupId = useId();
  const foldable = children !== undefined && children !== null && children !== false;

  const defaultMeta =
    joinMeta([
      folder.subfolderCount > 0 && folderRole && countNoun(folder.subfolderCount, folderRole.noun, folderRole.nounPlural),
      countNoun(folder.pageCount, manifest.pageRole.noun, manifest.pageRole.nounPlural),
    ]);

  const actions: RowAction[] = [
    { label: "Renombrar", icon: Pencil, onSelect: () => setRenameOpen(true) },
    ...extraActions,
    { label: "Eliminar", icon: Trash2, destructive: true, onSelect: () => setConfirmDelete(true) },
  ];

  return (
    <>
      <MarginRow
        data-folder-row=""
        margin={
          <span aria-hidden className="mt-[0.55rem] block font-display text-base leading-none font-bold">
            {toRoman(index)}
          </span>
        }
        trailing={
          <span className="flex items-center gap-1">
            {trailing}
            {foldable && (
              <Button
                variant="ghost"
                size="icon"
                aria-expanded={open}
                aria-controls={groupId}
                aria-label={open ? `Plegar ${folder.name}` : `Desplegar ${folder.name}`}
                onClick={() => setOpen((v) => !v)}
                className="relative z-(--z-raised) text-muted-foreground aria-expanded:bg-transparent md:pointer-fine:size-9"
              >
                <ChevronDown
                  aria-hidden
                  className={cn(
                    "size-5 transition-transform duration-(--dur-toque) ease-(--ease-pluma)",
                    open && "rotate-180",
                  )}
                />
              </Button>
            )}
            <RowActions subject={folder.name} actions={actions} />
          </span>
        }
        className={cn("group relative has-[a:hover]:bg-sf2/60", className)}
      >
        <Link
          href={href}
          className="line-clamp-2 rounded-sm font-semibold text-foreground focus-ring after:absolute after:inset-0 after:content-['']"
        >
          {folder.name}
        </Link>
        <span className="line-clamp-2 text-sm text-muted-foreground">{meta ?? defaultMeta}</span>
      </MarginRow>

      {foldable && open && (
        <div id={groupId} role="group" aria-label={folder.name} className="border-b border-border last:border-b-0">
          {children}
        </div>
      )}

      <RenameDialog
        open={renameOpen}
        onOpenChange={setRenameOpen}
        title={`Renombrar ${noun}`}
        current={folder.name}
        saving={renaming}
        onSave={(name) =>
          updateFolder({ folderId: folder.id, data: { name } }, { onSuccess: () => setRenameOpen(false) })
        }
      />
      <ConfirmDialog
        open={confirmDelete}
        title={`Eliminar ${noun}`}
        description={`"${folder.name}" y todo lo que contiene se eliminarán.`}
        onConfirm={() => {
          setConfirmDelete(false);
          deleteFolder(folder.id);
        }}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  );
}
