"use client";

import { useRef } from "react";
import { EditorProvider } from "./EditorContext";
import { NotebookEditor } from "./NotebookEditor";
import { StickyNotesGrid } from "@/features/sticky-notes/StickyNotesGrid";
import { MarginNotesLayer } from "@/features/sticky-notes/MarginNotesLayer";
import { useStickyNotesByPage } from "@/features/sticky-notes/sticky-notes.hooks";
import type { PageDetail } from "./pages.types";

/**
 * The Tiptap editing surface, isolated so it can be loaded with `next/dynamic`
 * ({ ssr: false }) from the layout (KIN-73). All heavy editor extensions
 * (StarterKit, table, suggestion, list — and image in Sprint 3) live behind this
 * boundary, so they land in a deferred client chunk instead of the route's
 * initial JS. Client-only load also sidesteps Tiptap's SSR hydration warning.
 */
export default function NotebookEditorSurface({
  page,
  systemId,
}: {
  page: PageDetail;
  systemId: string;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const { data: allNotes = [] } = useStickyNotesByPage(page.id);
  const marginNotes = allNotes.filter((n) => n.positionSide);
  const pageContext = { pageId: page.id };

  return (
    <EditorProvider key={page.id} initialContent={page.content ?? ""}>
      <div className="flex-1 overflow-y-auto">
        <div ref={contentRef} className="relative min-h-full">
          <div className="max-w-3xl mx-auto px-4 py-6 md:px-6 md:py-8 space-y-8">
            <StickyNotesGrid pageId={page.id} />
            <NotebookEditor page={page} systemId={systemId} pageId={page.id} />
          </div>
          <MarginNotesLayer
            notes={marginNotes}
            context={pageContext}
            containerRef={contentRef}
          />
        </div>
      </div>
    </EditorProvider>
  );
}
