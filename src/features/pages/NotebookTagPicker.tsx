"use client";

import { cn } from "@/lib/utils";
import { useTags } from "@/features/tags/tags.hooks";
import { usePageTags, useAddPageTag, useRemovePageTag } from "./pages.hooks";

const TAG_DOT: Record<string, string> = {
  red: "bg-red-500",
  blue: "bg-blue-500",
  pink: "bg-pink-500",
  purple: "bg-purple-500",
  green: "bg-green-500",
  orange: "bg-orange-500",
  yellow: "bg-yellow-500",
  teal: "bg-teal-500",
  gray: "bg-zinc-500",
  black: "bg-zinc-900",
  white: "bg-white border border-border",
};

interface NotebookTagPickerProps {
  pageId: string;
  systemId: string;
}

export function NotebookTagPicker({ pageId, systemId }: NotebookTagPickerProps) {
  const { data: allTags = [] } = useTags(systemId);
  const { data: pageTags = [] } = usePageTags(pageId);
  const { mutate: addTag } = useAddPageTag(pageId, systemId);
  const { mutate: removeTag } = useRemovePageTag(pageId, systemId);

  if (allTags.length === 0) return null;

  const activeIds = new Set(pageTags.map((t) => t.id));

  function toggle(tagId: string) {
    if (activeIds.has(tagId)) {
      removeTag(tagId);
    } else {
      addTag(tagId);
    }
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {allTags.map((tag) => {
        const active = activeIds.has(tag.id);
        return (
          <button
            key={tag.id}
            type="button"
            onClick={() => toggle(tag.id)}
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
  );
}
