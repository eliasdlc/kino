"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Files, FolderOpen, Loader2 } from "lucide-react";
import { useFolders, useCreateFolder } from "@/features/folders/folders.hooks";
import { usePages, useCreatePage } from "@/features/pages/pages.hooks";
import { useTags } from "@/features/tags/tags.hooks";
import { NotebooksToolbar } from "./NotebooksToolbar";
import { FolderCard } from "./FolderCard";
import { NotebookCard } from "./NotebookCard";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useSystemManifest } from "@/features/systems/systems.hooks";
import { capitalize } from "@/shared/lib/system-manifest";
import { pagesEmptyCopy } from "@/shared/lib/archetype-copy";

const TAG_DOT: Record<string, string> = {
  red: "bg-red-500", blue: "bg-blue-500", pink: "bg-pink-500",
  purple: "bg-purple-500", green: "bg-green-500", orange: "bg-orange-500",
  yellow: "bg-yellow-500", teal: "bg-teal-500", gray: "bg-zinc-500",
  black: "bg-zinc-900", white: "bg-white border border-border",
};

interface NotebooksViewProps {
  systemId: string;
}

export function NotebooksView({ systemId }: NotebooksViewProps) {
  const router = useRouter();
  const { data: folders = [], isLoading: foldersLoading } = useFolders(systemId);
  const { data: pages = [], isLoading: pagesLoading } = usePages(systemId);
  const { mutate: createFolder, isPending: creatingFolder } = useCreateFolder(systemId);
  const { mutateAsync: createPage } = useCreatePage(systemId);
  const { data: allTags = [] } = useTags(systemId);

  // Vocabulario del sistema: aquí no hay "carpetas" y "notebooks" salvo que el
  // arquetipo (o la composición del usuario) los llame así.
  const manifest = useSystemManifest(systemId);
  const folderRole = manifest.folderRole;
  const pageRole = manifest.pageRole;
  const empty = pagesEmptyCopy(manifest);

  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [activeTagIds, setActiveTagIds] = useState<Set<string>>(new Set());

  const isLoading = foldersLoading || pagesLoading;
  const allRootPages = pages.filter((p) => !p.folderId && !p.parentPageId);
  const rootPages = activeTagIds.size === 0
    ? allRootPages
    : allRootPages.filter((p) => p.tags.some((t) => activeTagIds.has(t.id)));
  const isEmpty = !isLoading && folders.length === 0 && allRootPages.length === 0;

  function toggleTag(tagId: string) {
    setActiveTagIds((prev) => {
      const next = new Set(prev);
      if (next.has(tagId)) next.delete(tagId);
      else next.add(tagId);
      return next;
    });
  }

  function handleCreateFolder() {
    if (!folderName.trim()) return;
    createFolder(
      { name: folderName.trim() },
      {
        onSuccess: () => {
          setFolderName("");
          setFolderDialogOpen(false);
        },
      }
    );
  }

  async function handleCreateNotebook() {
    const page = await createPage({});
    router.push(`/systems/${systemId}/pages/${page.id}`);
  }

  return (
    <div className="w-full space-y-6">
      <NotebooksToolbar
        onNewFolder={() => setFolderDialogOpen(true)}
        onNewPage={handleCreateNotebook}
        newFolderLabel={folderRole?.newLabel ?? null}
        newPageLabel={`${pageRole.gender === "f" ? "Nueva" : "Nuevo"} ${pageRole.noun}`}
      />

      {!isLoading && allTags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {allTags.map((tag) => {
            const active = activeTagIds.has(tag.id);
            return (
              <button
                key={tag.id}
                type="button"
                onClick={() => toggleTag(tag.id)}
                className={cn(
                  "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all",
                  active
                    ? "bg-muted border-foreground/30 text-foreground"
                    : "bg-transparent border-border text-muted-foreground hover:border-muted-foreground/50"
                )}
              >
                <span className={cn("h-2 w-2 rounded-full shrink-0", TAG_DOT[tag.color] ?? "bg-zinc-500")} />
                {tag.title}
              </button>
            );
          })}
        </div>
      )}

      {isLoading && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-2xl" />
          ))}
        </div>
      )}

      {!isLoading && isEmpty && (
        <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-sm">
          <Files className="size-4 shrink-0 text-muted-foreground" />
          <span><b className="font-semibold">{empty.title}</b> <span className="text-muted-foreground">{empty.hint}</span></span>
        </div>
      )}

      {!isLoading && folders.length > 0 && (
        <section className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
            <FolderOpen className="size-3.5" />
            {capitalize(folderRole?.nounPlural ?? "carpetas")}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {folders.map((folder) => (
              <FolderCard
                key={folder.id}
                folder={folder}
                systemId={systemId}
                onClick={() => router.push(`/systems/${systemId}/folders/${folder.id}`)}
              />
            ))}
          </div>
        </section>
      )}

      {!isLoading && rootPages.length > 0 && (
        <section className="space-y-3">
          {folders.length > 0 && (
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              {capitalize(pageRole.nounPlural)}
            </p>
          )}
          <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {rootPages.map((page) => (
              <NotebookCard
                key={page.id}
                page={page}
                systemId={systemId}
                href={`/systems/${systemId}/pages/${page.id}`}
              />
            ))}
          </div>
        </section>
      )}

      <ResponsiveDialog open={folderDialogOpen} onOpenChange={setFolderDialogOpen}>
        <ResponsiveDialogContent>
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>{folderRole?.newLabel ?? "Nueva carpeta"}</ResponsiveDialogTitle>
          </ResponsiveDialogHeader>
          <div className="flex flex-col gap-4 pt-1">
            <div className="space-y-1.5">
              <Label htmlFor="folder-name">Nombre</Label>
              <Input
                id="folder-name"
                autoFocus
                placeholder={folderRole?.placeholder ?? "Nombre de la carpeta"}
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreateFolder();
                }}
                maxLength={255}
              />
            </div>
            <Button
              onClick={handleCreateFolder}
              disabled={!folderName.trim() || creatingFolder}
            >
              {creatingFolder && <Loader2 className="size-4 animate-spin mr-2" />}
              {creatingFolder ? "Creando..." : `Crear ${folderRole?.noun ?? "carpeta"}`}
            </Button>
          </div>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </div>
  );
}
