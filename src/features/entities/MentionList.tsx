"use client";

import {
  forwardRef,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EntityType } from "./entities.attributes";
import { ENTITY_TYPE_ICON, ENTITY_TYPE_LABEL } from "./entities.ui";

export type MentionItem =
  | { kind: "entity"; id: string; name: string; type: EntityType }
  | { kind: "create"; name: string; type: EntityType };

export type MentionListRef = {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
};

export type MentionListProps = {
  items: MentionItem[];
  command: (item: MentionItem) => void;
};

export const MentionList = forwardRef<MentionListRef, MentionListProps>(
  function MentionList({ items, command }, ref) {
    const [selected, setSelected] = useState(0);
    const [prevItems, setPrevItems] = useState(items);
    const listRef = useRef<HTMLDivElement>(null);

    if (items !== prevItems) {
      setPrevItems(items);
      setSelected(0);
    }

    useLayoutEffect(() => {
      listRef.current
        ?.querySelector<HTMLElement>(`[data-index="${selected}"]`)
        ?.scrollIntoView({ block: "nearest" });
    }, [selected]);

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }) => {
        if (!items.length) return false;
        if (event.key === "ArrowDown") {
          setSelected((s) => (s + 1) % items.length);
          return true;
        }
        if (event.key === "ArrowUp") {
          setSelected((s) => (s - 1 + items.length) % items.length);
          return true;
        }
        if (event.key === "Enter") {
          const item = items[selected];
          if (item) command(item);
          return true;
        }
        return false;
      },
    }));

    if (!items.length) {
      return (
        <div className="w-72 rounded-lg border border-border bg-popover p-2 text-xs text-muted-foreground shadow-lg">
          Escribe un nombre para crear una entidad del codex
        </div>
      );
    }

    return (
      <div
        ref={listRef}
        className="w-72 max-h-72 overflow-y-auto rounded-lg border border-border bg-popover p-1 shadow-lg"
      >
        {items.map((item, i) => {
          const Icon =
            item.kind === "create" ? Plus : ENTITY_TYPE_ICON[item.type];
          const key = item.kind === "entity" ? `e-${item.id}` : `c-${item.type}`;
          return (
            <button
              key={key}
              type="button"
              data-index={i}
              onClick={() => command(item)}
              onMouseEnter={() => setSelected(i)}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors",
                i === selected
                  ? "bg-accent text-accent-foreground"
                  : "text-foreground hover:bg-accent/50",
              )}
            >
              <span className="flex size-7 shrink-0 items-center justify-center rounded border border-border bg-background">
                <Icon className="size-4" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">
                  {item.kind === "create" ? (
                    <>
                      Crear {ENTITY_TYPE_LABEL[item.type].toLowerCase()}{" "}
                      <span className="text-muted-foreground">«{item.name}»</span>
                    </>
                  ) : (
                    item.name
                  )}
                </span>
                {item.kind === "entity" && (
                  <span className="block truncate text-xs text-muted-foreground">
                    {ENTITY_TYPE_LABEL[item.type]}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    );
  },
);
