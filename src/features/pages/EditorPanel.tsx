"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, Download, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { MarginRow } from "@/components/ui/margin-row";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { CodexRail } from "@/features/entities/CodexRail";
import { ChapterStatusToggle } from "@/features/writing/ChapterStatusToggle";
import { WritingSessionButton } from "@/features/writing/WritingSessionButton";
import { ReferenceTable } from "@/features/writing/ReferenceTable";
import { ChapterHistory } from "@/features/writing/ChapterHistory";
import { ChapterSummaryPanel } from "@/features/writing/ChapterSummaryPanel";
import { usePinnedReferences } from "@/features/writing/pinned-references";
import { SectionHead } from "@/features/dashboard/SectionHead";
import { MargenDeUnaLinea, UNA_LINEA } from "@/shared/components/una-linea";
import { LinkedTasksPanel } from "./LinkedTasksPanel";
import { NotebookTagPicker } from "./NotebookTagPicker";
import { EditorShortcutsHelp } from "./EditorShortcutsHelp";
import { ManuscriptOutline } from "./mediums/ManuscriptOutline";
import { RAIL_MIN_ITEMS } from "./DocumentRail";
import { useSubPages, useCreateSubPage } from "./pages.hooks";
import { htmlToMarkdown, exportFileMeta } from "./export/html-to-markdown";
import { downloadBlob, slugify } from "@/shared/utils/download";
import type { OutlineItem } from "./mediums/outline";
import type { PageDetailTransport, PageListItemTransport } from "./pages.types";
import type { WriterObra } from "./WriterStatusBar";
import type { MediumManifest } from "@/shared/lib/mediums";

/**
 * El panel del documento abierto, en un chunk aparte que se pide al abrirlo.
 *
 * En el teléfono es una hoja inferior de Diario y la única puerta a todo lo
 * que no es escribir: por eso empieza por las dos acciones del capítulo (la
 * sesión y el estado), que en escritorio viven en la barra de arriba. En
 * escritorio es la hoja lateral de siempre, flotante.
 *
 * Sin cards: cada bloque es un encabezado y un hairline, y las listas que se
 * tocan (las páginas del cuaderno, exportar) son filas de margen de 48 px con
 * su glifo o su numeral a la izquierda.
 */
export interface EditorPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  page: PageDetailTransport;
  systemId: string;
  rootPageId: string;
  initialSubPages: PageListItemTransport[];
  writer: boolean;
  obra: WriterObra | null;
  obraMetadata: Record<string, unknown> | null;
  medium: MediumManifest | null;
  outline: OutlineItem[];
  onJump: (pos: number) => void;
}

export default function EditorPanel({ open, onOpenChange, ...props }: EditorPanelProps) {
  const isMobile = useIsMobile();
  const titulo = props.writer ? `Este ${props.medium?.unit.noun ?? "capítulo"}` : "Este documento";

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange} repositionInputs={false}>
        <DrawerContent>
          <DrawerHeader className="px-5 pt-2 pb-0 pr-14 text-left">
            <DrawerTitle className="font-display text-lg font-bold tracking-[-0.02em]">{titulo}</DrawerTitle>
          </DrawerHeader>
          <div className="overflow-y-auto px-5 pt-2 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
            <PanelBody {...props} onClose={() => onOpenChange(false)} movil />
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="gap-0 p-0 md:my-auto md:h-[95%]! md:w-[22rem]! md:rounded-xl">
        <SheetHeader className="px-5 pt-4 pb-1 pr-14">
          <SheetTitle className="font-display text-lg font-bold tracking-[-0.02em]">{titulo}</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-5 pb-6">
          <PanelBody {...props} onClose={() => onOpenChange(false)} movil={false} />
        </div>
      </SheetContent>
    </Sheet>
  );
}

function PanelBody({
  page,
  systemId,
  rootPageId,
  initialSubPages,
  writer,
  obra,
  obraMetadata,
  medium,
  outline,
  onJump,
  onClose,
  movil,
}: Omit<EditorPanelProps, "open" | "onOpenChange"> & { onClose: () => void; movil: boolean }) {
  const { pinnedIds, toggle: togglePin, canPin } = usePinnedReferences({
    systemId,
    folderId: obra?.id ?? null,
    metadata: obraMetadata,
  });
  const saltar = (pos: number) => {
    onJump(pos);
    onClose();
  };
  const bloque = "space-y-2 pt-5";

  return (
    <div>
      {/* Las dos acciones del capítulo. En escritorio están en la barra. */}
      {writer && movil && (
        <section aria-label="Acciones del capítulo">
          <WritingSessionButton pageId={page.id} pageTitle={page.title} systemId={systemId} variant="fila" />
          <ChapterStatusToggle
            pageId={page.id}
            systemId={systemId}
            title={page.title}
            initialCompletedAt={page.completedAt}
            unitNoun={medium?.unit.noun}
            variant="fila"
          />
        </section>
      )}

      <section className={cn(bloque, !(writer && movil) && "pt-2")}>
        <SectionHead as="h3" title="Páginas" />
        <PageIndex
          rootPageId={rootPageId}
          currentPage={page}
          systemId={systemId}
          initialSubPages={initialSubPages}
          medium={medium}
        />
      </section>

      {writer && (
        <section className={bloque}>
          <ManuscriptOutline
            items={outline}
            heading={`Índice del ${medium?.unit.noun ?? "capítulo"}`}
            onJump={saltar}
          />
        </section>
      )}

      {/* La versión táctil del carril: en escritorio el carril ya navega el
          documento, y dos índices a la vez es ruido. */}
      {!writer && movil && outline.length >= RAIL_MIN_ITEMS && (
        <section className={bloque}>
          <ManuscriptOutline items={outline} heading="Índice del documento" onJump={saltar} />
        </section>
      )}

      {writer && (
        <>
          <section className={bloque}>
            <CodexRail
              pageId={page.id}
              systemId={systemId}
              pinnedIds={pinnedIds}
              onTogglePin={canPin ? togglePin : undefined}
            />
          </section>
          <section className={bloque}>
            <ReferenceTable systemId={systemId} pinnedIds={pinnedIds} onToggle={togglePin} canPin={canPin} />
          </section>
          <section className={bloque}>
            <ChapterSummaryPanel pageId={page.id} />
          </section>
          <section className={bloque}>
            <ChapterHistory pageId={page.id} />
          </section>
        </>
      )}

      <NotebookTagPicker pageId={page.id} systemId={systemId} className={bloque} />

      <section className={bloque}>
        <LinkedTasksPanel pageId={page.id} systemId={systemId} />
      </section>

      <section className={bloque}>
        <SectionHead as="h3" title="Exportar" />
        <ExportRows page={page} medium={medium} />
      </section>

      {/* Los atajos son de teclado físico: en el teléfono no hay a quién
          enseñárselos, y la barra del pulgar ya pone el formato a mano. */}
      {!movil && (
        <section className={bloque}>
          <EditorShortcutsHelp medium={medium} />
        </section>
      )}
    </div>
  );
}

/**
 * Las páginas del cuaderno como índice de Diario: la portada con su glifo en el
 * margen y cada página con su numeral, en `--mute`. La abierta va en tinta y
 * en peso, con `aria-current`; nada de fondo de color.
 */
function PageIndex({
  rootPageId,
  currentPage,
  systemId,
  initialSubPages,
  medium = null,
}: {
  rootPageId: string;
  currentPage: PageDetailTransport;
  systemId: string;
  initialSubPages: PageListItemTransport[];
  medium?: MediumManifest | null;
}) {
  const router = useRouter();
  const { data: subPages = initialSubPages ?? [] } = useSubPages(rootPageId);
  const { mutate: createSubPage, isPending } = useCreateSubPage(rootPageId, systemId);
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const nuevaEtiqueta = medium ? medium.unit.newLabel : "Nueva página";
  const enPortada = currentPage.id === rootPageId;

  function handleCreate() {
    if (isPending) return;
    const title = newTitle.trim();
    createSubPage(
      // La plantilla del medium arranca la estructura (una página con su primer
      // panel, un encabezado de escena): la prosa nace en blanco.
      { title: title || undefined, content: medium?.template || undefined },
      {
        onSuccess: (page) => {
          setNewTitle("");
          setAdding(false);
          router.push(`/systems/${systemId}/pages/${page.id}`);
        },
      },
    );
  }

  return (
    <div>
      <MarginRow
        href={`/systems/${systemId}/pages/${rootPageId}`}
        aria-current={enPortada ? "page" : undefined}
        className={UNA_LINEA}
        margin={<MargenDeUnaLinea><BookOpen aria-hidden className="size-5" /></MargenDeUnaLinea>}
      >
        <span className={cn("block truncate font-serif text-base", enPortada ? "font-semibold text-foreground" : "text-body")}>
          {enPortada ? currentPage.title || "Sin título" : "Portada"}
        </span>
      </MarginRow>

      {subPages.map((sp, i) => {
        const actual = currentPage.id === sp.id;
        return (
          <MarginRow
            key={sp.id}
            href={`/systems/${systemId}/pages/${sp.id}`}
            aria-current={actual ? "page" : undefined}
            className={UNA_LINEA}
            margin={
              <MargenDeUnaLinea>
                <span className="font-display text-base font-bold text-muted-foreground tabular-nums">{i + 1}</span>
              </MargenDeUnaLinea>
            }
          >
            <span className={cn("block truncate font-serif text-base", actual ? "font-semibold text-foreground" : "text-body")}>
              {(actual ? currentPage.title : sp.title) || "Sin título"}
            </span>
          </MarginRow>
        );
      })}

      {adding ? (
        <div className="grid min-h-[3.4rem] grid-cols-[var(--margen)_1fr] items-center">
          <Plus aria-hidden className="size-5 justify-self-center text-muted-foreground" />
          <div className="py-2">
            <input
              autoFocus
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate();
                if (e.key === "Escape") {
                  setAdding(false);
                  setNewTitle("");
                }
              }}
              onBlur={() => {
                if (!newTitle.trim() && !isPending) setAdding(false);
              }}
              aria-label={nuevaEtiqueta}
              placeholder={`${nuevaEtiqueta}: título`}
              maxLength={500}
              disabled={isPending}
              className="h-[2.85rem] w-full rounded-full border border-border bg-background px-4 font-serif text-base outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            />
            {isPending && (
              <p role="status" className="mt-1 pl-4 text-sm text-muted-foreground">
                Creando la página
              </p>
            )}
          </div>
        </div>
      ) : (
        <MarginRow
          onClick={() => setAdding(true)}
          className={UNA_LINEA}
          margin={<MargenDeUnaLinea><Plus aria-hidden className="size-5" /></MargenDeUnaLinea>}
        >
          <span className="block text-base font-semibold text-primary">{nuevaEtiqueta}</span>
        </MarginRow>
      )}
    </div>
  );
}

/** Exportar el documento: dos filas de margen, cada una con su formato. */
function ExportRows({ page, medium = null }: { page: PageDetailTransport; medium?: MediumManifest | null }) {
  // El medium decide el serializador: un guion sale en Fountain (.fountain), lo
  // que importan Final Draft y Highland; el resto en Markdown (PLAN-11 §6).
  const { extension, label } = exportFileMeta(medium?.id ?? null);

  function exportMarkdown() {
    const md = htmlToMarkdown(page.content ?? "", { medium: medium?.id ?? null });
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    downloadBlob(blob, `${slugify(page.title ?? "")}.${extension}`);
  }

  function exportJson() {
    const payload = {
      id: page.id,
      title: page.title,
      content: page.content,
      createdAt: page.createdAt,
      updatedAt: page.updatedAt,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json;charset=utf-8",
    });
    downloadBlob(blob, `${slugify(page.title ?? "")}.json`);
  }

  return (
    <div>
      <MarginRow onClick={exportMarkdown} className={UNA_LINEA} margin={<MargenDeUnaLinea><Download aria-hidden className="size-5" /></MargenDeUnaLinea>}>
        <span className="block text-base text-foreground">{label}</span>
      </MarginRow>
      <MarginRow onClick={exportJson} className={UNA_LINEA} margin={<MargenDeUnaLinea><Download aria-hidden className="size-5" /></MargenDeUnaLinea>}>
        <span className="block text-base text-foreground">JSON (.json)</span>
      </MarginRow>
    </div>
  );
}
