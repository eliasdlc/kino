"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { useTags, useCreateTag } from "./tags.hooks";
import { tagDotClass } from "./tag-colors";

/** Colores que se rotan al crear categorías nuevas. */
const PALETTE = ["blue", "green", "purple", "orange", "teal", "pink", "red", "yellow"] as const;

interface TagPickerProps {
  systemId: string;
  value: string | null | undefined;
  onChange: (tagId: string | null) => void;
  /** Si se pasa, envuelve el selector con un Label arriba. */
  label?: string;
  /** Permite crear categorías nuevas inline (y renderiza aunque no haya ninguna). */
  allowCreate?: boolean;
}

/**
 * Selector de categoría (context_tag) de un solo valor. En modo display se
 * oculta si el sistema no tiene tags; con `allowCreate` siempre se muestra para
 * poder crear la primera categoría.
 */
export function TagPicker({ systemId, value, onChange, label, allowCreate }: TagPickerProps) {
  const { data: tags = [] } = useTags(systemId);
  const { mutate: createTag, isPending } = useCreateTag(systemId);

  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");

  if (tags.length === 0 && !allowCreate) return null;

  function submit() {
    const trimmed = name.trim();
    if (!trimmed) return;
    const color = PALETTE[tags.length % PALETTE.length];
    createTag(
      { title: trimmed, color },
      {
        onSuccess: (tag) => {
          onChange(tag.id);
          setName("");
          setAdding(false);
        },
      },
    );
  }

  const chips = (
    <div className="flex items-center gap-1.5 flex-wrap">
      {tags.map((tag) => {
        const selected = value === tag.id;
        return (
          <button
            key={tag.id}
            type="button"
            onClick={() => onChange(selected ? null : tag.id)}
            className={cn(
              "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-[color,background-color,border-color] duration-(--dur-toque) ease-(--ease-pluma) focus-ring pointer-coarse:min-h-[2.85rem] pointer-coarse:px-3.5 pointer-coarse:text-sm",
              selected
                ? "bg-muted border-foreground/30 text-foreground"
                : "bg-transparent border-border text-muted-foreground hover:border-muted-foreground/50",
            )}
          >
            <span className={cn("h-2 w-2 rounded-full shrink-0", tagDotClass(tag.color))} />
            {tag.title}
          </button>
        );
      })}

      {allowCreate &&
        (adding ? (
          <input
            autoFocus
            value={name}
            maxLength={24}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submit();
              }
              if (e.key === "Escape") {
                setName("");
                setAdding(false);
              }
            }}
            onBlur={() => {
              if (!name.trim()) setAdding(false);
            }}
            placeholder="Nueva categoría"
            disabled={isPending}
            aria-label="Nueva categoría"
            className="rounded-full border bg-muted px-2.5 py-1 text-xs outline-none focus-ring pointer-coarse:min-h-[2.85rem] pointer-coarse:px-3.5 pointer-coarse:text-base"
          />
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-2.5 py-1 text-xs font-medium text-muted-foreground transition-[color,border-color] duration-(--dur-toque) ease-(--ease-pluma) hover:border-muted-foreground/50 focus-ring pointer-coarse:min-h-[2.85rem] pointer-coarse:px-3.5 pointer-coarse:text-sm"
          >
            <Plus size={12} /> Categoría
          </button>
        ))}
    </div>
  );

  if (!label) return chips;
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {chips}
    </div>
  );
}
