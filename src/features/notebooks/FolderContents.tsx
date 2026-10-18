"use client";

import { Folder } from "lucide-react";
import { MarginRow } from "@/components/ui/margin-row";
import { MarginRowSkeleton } from "@/components/Skeletons";
import { useFolderChildren } from "@/features/folders/folders.hooks";
import type { PageListItemTransport } from "@/features/pages/pages.types";
import { useSystemManifest } from "@/features/systems/systems.hooks";
import { countNoun } from "./index-format";
import { NotebookRow } from "./NotebookRow";

interface FolderContentsProps {
  systemId: string;
  folderId: string;
  /** Los documentos de la carpeta, que la lista del sistema ya trae. */
  pages: PageListItemTransport[];
  now?: Date;
}

/**
 * Lo que asoma al desplegar una carpeta en el índice: sus subcarpetas con el
 * glifo de carpeta en el margen y sus documentos numerados. Las subcarpetas se
 * piden al desplegar y no antes; los documentos ya venían con el sistema.
 */
export function FolderContents({ systemId, folderId, pages, now }: FolderContentsProps) {
  const manifest = useSystemManifest(systemId);
  const { data: children, isLoading } = useFolderChildren(folderId);
  const documentos = pages.filter((p) => p.folderId === folderId && !p.parentPageId);

  if (isLoading) return <MarginRowSkeleton margin="none" />;

  if ((children?.length ?? 0) === 0 && documentos.length === 0) {
    return (
      <p className="py-3 pl-(--margen) text-sm text-muted-foreground">
        {`Sin ${manifest.pageRole.nounPlural} todavía.`}
      </p>
    );
  }

  return (
    <>
      {children?.map((child) => (
        <MarginRow
          key={child.id}
          href={`/systems/${systemId}/folders/${child.id}`}
          margin={<Folder className="mt-[0.45rem] size-5" aria-hidden />}
        >
          <span className="block truncate text-foreground">{child.name}</span>
          <span className="block text-sm text-muted-foreground">
            {countNoun(child.pageCount, manifest.pageRole.noun, manifest.pageRole.nounPlural)}
          </span>
        </MarginRow>
      ))}
      {documentos.map((page, i) => (
        <NotebookRow
          key={page.id}
          page={page}
          systemId={systemId}
          index={i + 1}
          href={`/systems/${systemId}/pages/${page.id}`}
          now={now}
        />
      ))}
    </>
  );
}
