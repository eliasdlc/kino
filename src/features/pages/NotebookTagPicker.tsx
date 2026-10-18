"use client";

import { cn } from "@/lib/utils";
import { useTags } from "@/features/tags/tags.hooks";
import { tagDotClass } from "@/features/tags/tag-colors";
import { PanelHeading } from "./PanelHeading";
import { usePageTags, useAddPageTag, useRemovePageTag } from "./pages.hooks";

interface NotebookTagPickerProps {
  pageId: string;
  systemId: string;
  /** Clase del bloque: el panel decide el aire entre bloques. */
  className?: string;
}

/**
 * Las etiquetas del sistema como pastillas que se encienden y se apagan sobre
 * la página. La puesta va en tinta (selección es estado, no acción) y con
 * `aria-pressed`; el color de cada etiqueta sale del mapa único de etiquetas.
 * Sin etiquetas en el sistema el bloque entero no se pinta: un encabezado
 * sobre nada es espacio vacío.
 */
export function NotebookTagPicker({ pageId, systemId, className }: NotebookTagPickerProps) {
  const { data: allTags = [] } = useTags(systemId);
  const { data: pageTags = [] } = usePageTags(pageId);
  const { mutate: addTag } = useAddPageTag(pageId, systemId);
  const { mutate: removeTag } = useRemovePageTag(pageId, systemId);

  if (allTags.length === 0) return null;

  const activeIds = new Set<string>(pageTags.map((t) => t.id));

  function toggle(tagId: string) {
    if (activeIds.has(tagId)) {
      removeTag(tagId);
    } else {
      addTag(tagId);
    }
  }

  return (
    <section className={cn("space-y-2", className)}>
      <PanelHeading>Etiquetas</PanelHeading>
      <div className="flex flex-wrap gap-1.5 pt-1">
        {allTags.map((tag) => {
          const active = activeIds.has(tag.id);
          return (
            <button
              key={tag.id}
              type="button"
              aria-pressed={active}
              onClick={() => toggle(tag.id)}
              className={cn(
                "press inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition-[color,background-color,border-color,transform] duration-(--dur-toque) ease-(--ease-pluma) focus-ring pointer-coarse:h-[2.85rem]",
                active
                  ? "border-foreground bg-foreground text-background"
                  : "border-border text-muted-foreground hover:border-ln2 hover:text-foreground",
              )}
            >
              <span aria-hidden className={cn("size-2 shrink-0 rounded-full", tagDotClass(tag.color))} />
              {tag.title}
            </button>
          );
        })}
      </div>
    </section>
  );
}
