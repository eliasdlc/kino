"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PanelRight, Plus, Loader2, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { PageBreadcrumb } from "@/components/PageBreadcrumb";
import { LinkedTasksPanel } from "./LinkedTasksPanel";
import { NotebookTagPicker } from "./NotebookTagPicker";
import { EditorShortcutsHelp } from "./EditorShortcutsHelp";
import { useSubPages, useCreateSubPage } from "./pages.hooks";
import { htmlToMarkdown } from "./export/html-to-markdown";
import type { BreadcrumbItem } from "@/components/PageBreadcrumb";
import type { PageDetail, PageListItem } from "./pages.types";
import type { WriterObra } from "./WriterStatusBar";

// The Tiptap surface (StarterKit + table + suggestion + list, plus image in
// Sprint 3) is loaded client-side on demand so it stays out of the route's
// initial JS bundle (KIN-73).
const NotebookEditorSurface = dynamic(() => import("./NotebookEditorSurface"), {
  ssr: false,
  loading: () => (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-4 py-6 md:px-6 md:py-8 space-y-3">
        <div className="h-7 w-1/3 animate-pulse rounded bg-muted" />
        <div className="h-4 w-full animate-pulse rounded bg-muted/70" />
        <div className="h-4 w-5/6 animate-pulse rounded bg-muted/70" />
        <div className="h-4 w-2/3 animate-pulse rounded bg-muted/70" />
      </div>
    </div>
  ),
});

function slugify(title: string): string {
  return (title || "sin-titulo")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function ExportPanel({ page }: { page: PageDetail }) {
  function exportMarkdown() {
    const md = htmlToMarkdown(page.content ?? "");
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    downloadBlob(blob, `${slugify(page.title ?? "")}.md`);
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
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
        Exportar
      </p>
      <div className="flex flex-col gap-1">
        <Button
          variant="ghost"
          size="sm"
          className="justify-start gap-2 h-8 px-2 text-sm font-normal"
          onClick={exportMarkdown}
        >
          <Download className="size-3.5 shrink-0" />
          Markdown (.md)
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="justify-start gap-2 h-8 px-2 text-sm font-normal"
          onClick={exportJson}
        >
          <Download className="size-3.5 shrink-0" />
          JSON (.json)
        </Button>
      </div>
    </div>
  );
}

interface NotebookEditorLayoutProps {
  page: PageDetail;
  systemId: string;
  systemName: string;
  allPages: PageListItem[];
  breadcrumbItems: BreadcrumbItem[];
  /** The root notebook — null if current page IS the root */
  parentNotebook: PageListItem | null;
  /** Sub-pages of the root notebook (pre-fetched server-side) */
  initialSubPages: PageListItem[];
  /** Arquetipo Writing: activa el "writer feel" del editor (PLAN-11 §7). */
  writer?: boolean;
  /** Obra a la que pertenece el capítulo — alimenta el progreso de la status bar. */
  obra?: WriterObra | null;
}

function SubPagesSidebar({
  rootPageId,
  currentPageId,
  systemId,
  systemName,
  initialSubPages,
}: {
  rootPageId: string;
  currentPageId: string;
  systemId: string;
  systemName: string;
  initialSubPages: PageListItem[];
}) {
  const router = useRouter();
  const { data: subPages = initialSubPages ?? [] } = useSubPages(rootPageId);
  const { mutate: createSubPage, isPending } = useCreateSubPage(rootPageId, systemId);
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");

  function handleCreate() {
    const title = newTitle.trim();
    createSubPage(
      { title: title || undefined },
      {
        onSuccess: (page) => {
          setNewTitle("");
          setAdding(false);
          router.push(`/systems/${systemId}/pages/${page.id}`);
        },
      }
    );
  }

  return (
    <div>
      <div className="p-3 space-y-1">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground px-2 mb-2">
          {systemName}
        </p>

        {/* Root notebook link */}
        <Link
          href={`/systems/${systemId}/pages/${rootPageId}`}
          className={`block px-2 py-1.5 rounded-md text-sm font-semibold transition-colors truncate ${currentPageId === rootPageId
            ? "bg-accent text-accent-foreground"
            : "text-foreground hover:bg-accent/50"
            }`}
        >
          Portada
        </Link>

        {subPages.length > 0 && (
          <div className="ml-2 border-l border-border/50 pl-2 space-y-0.5 mt-1">
            {subPages.map((sp) => (
              <Link
                key={sp.id}
                href={`/systems/${systemId}/pages/${sp.id}`}
                className={`block px-2 py-1.5 rounded-md text-xs transition-colors truncate ${currentPageId === sp.id
                  ? "bg-accent text-accent-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                  }`}
              >
                {sp.title ?? "Sin título"}
              </Link>
            ))}
          </div>
        )}

        {adding ? (
          <div className="ml-4 mt-1">
            <input
              autoFocus
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate();
                if (e.key === "Escape") { setAdding(false); setNewTitle(""); }
              }}
              onBlur={() => { if (!newTitle.trim()) setAdding(false); }}
              placeholder="Nueva página..."
              maxLength={500}
              className="w-full bg-muted/60 rounded px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-primary/40 border border-border"
            />
            {isPending && <Loader2 className="size-3 animate-spin mt-1 text-muted-foreground" />}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors ml-2"
          >
            <Plus className="size-3" />
            Nueva página
          </button>
        )}
      </div>
    </div>
  );
}

export function NotebookEditorLayout({
  page,
  systemId,
  systemName,
  breadcrumbItems,
  parentNotebook,
  initialSubPages,
  writer = false,
  obra = null,
}: NotebookEditorLayoutProps) {
  const [rightOpen, setRightOpen] = useState(false);
  const [focusMode, setFocusMode] = useState(false);

  const rootPageId = parentNotebook?.id ?? page.id;

  // Esc sale del modo focus (PLAN-11 §7).
  useEffect(() => {
    if (!focusMode) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFocusMode(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focusMode]);

  return (
    <div className="flex h-full overflow-hidden flex-col">
      {/* Breadcrumb bar — oculta en modo focus para dejar solo el texto */}
      <div
        className={cn(
          "sticky top-0 z-10 bg-background border-b px-4 md:px-3 py-2.5 shrink-0 flex items-center gap-2",
          focusMode && "hidden"
        )}
      >
        <div className="flex-1 min-w-0">
          <PageBreadcrumb items={breadcrumbItems} />
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="size-7 shrink-0 text-muted-foreground"
          onClick={() => setRightOpen(true)}
          aria-label="Abrir panel"
        >
          <PanelRight className="size-4" />
        </Button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Main editor — centered content with free-floating margin notes overlay */}
        <NotebookEditorSurface
          page={page}
          systemId={systemId}
          writer={writer}
          obra={obra}
          focusMode={focusMode}
          onToggleFocus={() => setFocusMode((f) => !f)}
        />
      </div>

      {/* Floating right panel */}
      <Sheet open={rightOpen} onOpenChange={setRightOpen}>
        <SheetContent side="right" className="!w-70 !h-[95%] !my-auto rounded-2xl shadow-2xl p-0 flex flex-col gap-0">
          <SheetTitle className="sr-only">Panel del cuaderno</SheetTitle>

          <SubPagesSidebar
            rootPageId={rootPageId}
            currentPageId={page.id}
            systemId={systemId}
            systemName={systemName}
            initialSubPages={initialSubPages}
          />

          <Separator />

          <div className="p-4 space-y-4 flex-1 overflow-y-auto">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Etiquetas
              </p>
              <NotebookTagPicker pageId={page.id} systemId={systemId} />
            </div>

            <Separator />

            <LinkedTasksPanel pageId={page.id} systemId={systemId} />

            <Separator />

            <ExportPanel page={page} />

            <Separator />

            <EditorShortcutsHelp />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
