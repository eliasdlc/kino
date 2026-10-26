"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAcademicScope } from "@/features/academic/academic-scope";
import { ClassRow } from "@/features/academic/ClassRow";
import type { AcademicPeriod } from "@/features/academic/academic.hooks";
import { useTasks } from "@/features/tasks/tasks.hooks";
import type { TaskTransport } from "@/features/tasks/tasks.types";
import { useFolders, useCreateFolder } from "@/features/folders/folders.hooks";
import { usePages, useCreatePage } from "@/features/pages/pages.hooks";
import { useTags } from "@/features/tags/tags.hooks";
import { tagDotClass } from "@/features/tags/tag-colors";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RowsSkeleton } from "@/components/Skeletons";
import { cn } from "@/lib/utils";
import { useSystemManifest } from "@/features/systems/systems.hooks";
import { capitalize } from "@/shared/lib/system-manifest";
import { pagesEmptyCopy } from "@/shared/lib/archetype-copy";
import { FolderContents } from "./FolderContents";
import { FolderRow } from "./FolderRow";
import { IndexHead } from "./IndexHead";
import { NotebookRow } from "./NotebookRow";
import { countNoun } from "./index-format";
import { NATIVE_SELECT_CLASS } from "./native-select";

interface NotebooksViewProps {
  systemId: string;
  /**
   * Un sistema académico pinta clases, no carpetas: la fila dice profesor,
   * horario, pendientes y próxima entrega, que es lo que decide a cuál entras.
   * Las dos listas necesitan las tareas del sistema.
   */
  academic?: boolean;
  periods?: AcademicPeriod[];
  initialTasks?: TaskTransport[];
}

/**
 * La biblioteca de un sistema como índice: sus carpetas con numeral romano,
 * que se despliegan aquí mismo, y sus documentos sueltos numerados con la
 * cifra de palabras a la derecha. Cada sección lleva su acción de crear en el
 * propio título; nada es una tarjeta.
 */
export function NotebooksView({ systemId, academic = false, periods = [], initialTasks = [] }: NotebooksViewProps) {
  const router = useRouter();
  const academicScope = useAcademicScope(systemId);
  const { data: tasks = [] } = useTasks(systemId, initialTasks);
  const [pageDialogOpen, setPageDialogOpen] = useState(false);
  const [pageFolder, setPageFolder] = useState("");
  const { data: folders = [], isLoading: foldersLoading } = useFolders(systemId);
  const { data: pages = [], isLoading: pagesLoading, restantes } = usePages(systemId);
  const { mutate: createFolder, isPending: creatingFolder } = useCreateFolder(systemId);
  const { mutateAsync: createPage, isPending: creatingPage } = useCreatePage(systemId);
  const { data: allTags = [] } = useTags(systemId);

  // Vocabulario del sistema: aquí no hay "carpetas" ni "notebooks" salvo que
  // el arquetipo (o la composición del usuario) los llame así.
  const manifest = useSystemManifest(systemId);
  const folderRole = manifest.folderRole;
  const pageRole = manifest.pageRole;
  const empty = pagesEmptyCopy(manifest);
  const newPageLabel = `${pageRole.gender === "f" ? "Nueva" : "Nuevo"} ${pageRole.noun}`;

  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [activeTagIds, setActiveTagIds] = useState<Set<string>>(new Set());

  const isLoading = foldersLoading || pagesLoading;
  const allRootPages = pages.filter((p) => !p.folderId && !p.parentPageId);
  // Sólo las etiquetas que filtran algo de esta lista: una pastilla que no
  // deja nada al tocarla es ruido de 48 px. Una etiqueta activa se sigue
  // ofreciendo aunque ya nada la lleve, para poder quitar el filtro.
  const usedTags = allTags.filter(
    (tag) => activeTagIds.has(tag.id) || allRootPages.some((p) => p.tags.some((t) => t.id === tag.id))
  );
  const rootPages =
    activeTagIds.size === 0 ? allRootPages : allRootPages.filter((p) => p.tags.some((t) => activeTagIds.has(t.id)));
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
      },
    );
  }

  async function handleCreateNotebook() {
    if (academicScope?.academicPeriodId && !pageDialogOpen) {
      setPageDialogOpen(true);
      return;
    }
    const page = await createPage(pageFolder ? { folderId: pageFolder } : {});
    router.push(`/systems/${systemId}/pages/${page.id}`);
  }

  const crearCarpeta = folderRole && (
    <Button variant="link" size="sm" className="px-1" onClick={() => setFolderDialogOpen(true)}>
      {folderRole.newLabel}
    </Button>
  );
  const crearPagina = (
    <Button variant="link" size="sm" className="px-1" disabled={creatingPage} onClick={handleCreateNotebook}>
      {creatingPage ? "Creando" : newPageLabel}
    </Button>
  );

  return (
    <div className="w-full space-y-7">
      {isLoading && (
        <div role="status" aria-busy aria-label="Cargando la biblioteca">
          <RowsSkeleton rows={5} margin="numeral" />
        </div>
      )}

      {isEmpty && (
        <EmptyState
          className="pl-(--margen)"
          title={empty.title}
          description={empty.hint}
          action={
            <div className="flex flex-wrap gap-2">
              <Button onClick={handleCreateNotebook} disabled={creatingPage}>
                {creatingPage ? "Creando" : newPageLabel}
              </Button>
              {folderRole && (
                <Button variant="outline" onClick={() => setFolderDialogOpen(true)}>
                  {folderRole.newLabel}
                </Button>
              )}
            </div>
          }
        />
      )}

      {!isLoading && !isEmpty && folderRole && (
        <section aria-labelledby={`${systemId}-carpetas`}>
          <IndexHead id={`${systemId}-carpetas`} title={capitalize(folderRole.nounPlural)} trailing={crearCarpeta} />
          {folders.length === 0 ? (
            <p className="py-3 pl-(--margen) text-sm text-muted-foreground">{`Sin ${folderRole.nounPlural} todavía.`}</p>
          ) : (
            <div>
              {folders.map((folder, i) =>
                academic ? (
                  <ClassRow
                    key={folder.id}
                    index={i + 1}
                    folder={folder}
                    systemId={systemId}
                    periods={periods}
                    manifest={manifest}
                    tasks={tasks.filter((task) => task.folderId === folder.id)}
                    href={`/systems/${systemId}/folders/${folder.id}`}
                  />
                ) : (
                  <FolderRow
                    key={folder.id}
                    index={i + 1}
                    folder={folder}
                    systemId={systemId}
                    href={`/systems/${systemId}/folders/${folder.id}`}
                    manifest={manifest}
                  >
                    <FolderContents systemId={systemId} folderId={folder.id} pages={pages} manifest={manifest} />
                  </FolderRow>
                ),
              )}
            </div>
          )}
        </section>
      )}

      {!isLoading && !isEmpty && (
        <section aria-labelledby={`${systemId}-paginas`}>
          <IndexHead
            id={`${systemId}-paginas`}
            title={folderRole ? `${capitalize(pageRole.nounPlural)} ${pageRole.gender === "f" ? "sueltas" : "sueltos"}` : capitalize(pageRole.nounPlural)}
            trailing={crearPagina}
          />

          {usedTags.length > 0 && (
            <div role="group" aria-label="Filtrar por etiqueta" className="flex flex-wrap gap-2 py-3 pl-(--margen)">
              {usedTags.map((tag) => {
                const active = activeTagIds.has(tag.id);
                return (
                  <button
                    key={tag.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => toggleTag(tag.id)}
                    className={cn(
                      "press inline-flex h-[2.85rem] items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-[color,background-color,border-color,transform] duration-(--dur-toque) ease-(--ease-pluma) focus-ring md:pointer-fine:h-9",
                      active
                        ? "border-foreground bg-foreground text-background"
                        : "border-input text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <span aria-hidden className={cn("size-2 shrink-0 rounded-full", tagDotClass(tag.color))} />
                    {tag.title}
                  </button>
                );
              })}
            </div>
          )}

          {rootPages.length === 0 ? (
            <p className="py-3 pl-(--margen) text-sm text-muted-foreground">
              {activeTagIds.size > 0
                ? `${pageRole.gender === "f" ? "Ninguna" : "Ninguno"} lleva esas etiquetas.`
                : `Sin ${pageRole.nounPlural} fuera de ${folderRole ? `tus ${folderRole.nounPlural}` : "una carpeta"}.`}
            </p>
          ) : (
            <div>
              {rootPages.map((page, i) => (
                <NotebookRow
                  key={page.id}
                  index={i + 1}
                  page={page}
                  systemId={systemId}
                  href={`/systems/${systemId}/pages/${page.id}`}
                  manifest={manifest}
                />
              ))}
            </div>
          )}
          {restantes > 0 && (
            <p className="pt-3 pl-(--margen) text-sm text-muted-foreground">
              {`Se muestran ${countNoun(pages.length, pageRole.noun, pageRole.nounPlural)}; hay más que no caben en esta lista. Usa Buscar para llegar al resto.`}
            </p>
          )}
        </section>
      )}

      <ResponsiveDialog open={pageDialogOpen} onOpenChange={setPageDialogOpen}>
        <ResponsiveDialogContent>
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>{newPageLabel}</ResponsiveDialogTitle>
          </ResponsiveDialogHeader>
          <div className="flex flex-col gap-4 pt-1">
            <div className="space-y-1.5">
              <Label htmlFor="page-subject">{`${capitalize(folderRole?.noun ?? "materia")} de este ciclo`}</Label>
              <select
                id="page-subject"
                className={NATIVE_SELECT_CLASS}
                value={pageFolder}
                onChange={(e) => setPageFolder(e.target.value)}
              >
                <option value="">{`Elige ${folderRole?.gender === "m" ? "un" : "una"} ${folderRole?.noun ?? "materia"}`}</option>
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>
            {folders.length === 0 && (
              <p className="text-sm text-muted-foreground">{`Crea ${folderRole?.gender === "m" ? "un" : "una"} ${folderRole?.noun ?? "clase"} para guardar su primer ${pageRole.noun}.`}</p>
            )}
            <Button disabled={!folders.some((f) => f.id === pageFolder) || creatingPage} onClick={handleCreateNotebook}>
              {creatingPage ? "Creando" : `Crear ${pageRole.noun}`}
            </Button>
          </div>
        </ResponsiveDialogContent>
      </ResponsiveDialog>

      <ResponsiveDialog open={folderDialogOpen} onOpenChange={setFolderDialogOpen}>
        <ResponsiveDialogContent>
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>{folderRole?.newLabel ?? "Nueva carpeta"}</ResponsiveDialogTitle>
          </ResponsiveDialogHeader>
          <form
            className="flex flex-col gap-4 pt-1"
            onSubmit={(e) => {
              e.preventDefault();
              handleCreateFolder();
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="folder-name">Nombre</Label>
              <Input
                id="folder-name"
                autoFocus
                placeholder={folderRole?.placeholder ?? "Nombre"}
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
                maxLength={255}
              />
            </div>
            <Button type="submit" disabled={!folderName.trim() || creatingFolder}>
              {creatingFolder ? "Creando" : `Crear ${folderRole?.noun ?? "carpeta"}`}
            </Button>
          </form>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </div>
  );
}
