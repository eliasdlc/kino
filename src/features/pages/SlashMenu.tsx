"use client";

import {
  forwardRef,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { Editor, Range } from "@tiptap/react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type SlashItem = {
  title: string;
  subtitle?: string;
  icon: LucideIcon;
  keywords: string[];
  command: (opts: { editor: Editor; range: Range }) => void;
};

export type SlashMenuRef = {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
};

export type SlashMenuProps = {
  items: SlashItem[];
  command: (item: SlashItem) => void;
};

/**
 * La superficie del menú: radio de superficie, la sombra de la casa y un ancho
 * que nunca pasa de la pantalla menos su canto. En un dedo cada fila mide 48 px.
 */
const MENU =
  "w-[min(16rem,calc(100vw-1rem))] rounded-xl border border-border bg-popover text-popover-foreground shadow-(--shadow)";

export const SlashMenu = forwardRef<SlashMenuRef, SlashMenuProps>(
  function SlashMenu({ items, command }, ref) {
    const [selected, setSelected] = useState(0);
    const [prevItems, setPrevItems] = useState(items);
    const listRef = useRef<HTMLDivElement>(null);

    // Reset the highlight to the top whenever the filtered items change
    // (React-recommended "adjust state during render" instead of an effect).
    if (items !== prevItems) {
      setPrevItems(items);
      setSelected(0);
    }

    // Keep the highlighted item scrolled into view.
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
        <div className={cn(MENU, "p-3 text-sm text-muted-foreground")}>
          Ningún bloque se llama así
        </div>
      );
    }

    return (
      <div
        ref={listRef}
        role="listbox"
        aria-label="Insertar bloque"
        className={cn(MENU, "max-h-72 overflow-y-auto p-1")}
      >
        {items.map((item, i) => {
          const Icon = item.icon;
          return (
            <button
              key={item.title}
              type="button"
              role="option"
              aria-selected={i === selected}
              data-index={i}
              onClick={() => command(item)}
              onMouseEnter={() => setSelected(i)}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-foreground transition-colors duration-(--dur-toque) ease-(--ease-pluma) pointer-coarse:min-h-[2.85rem]",
                i === selected ? "bg-secondary" : "hover:bg-secondary/60"
              )}
            >
              <span className="flex size-7 shrink-0 items-center justify-center text-muted-foreground">
                <Icon className="size-4" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">
                  {item.title}
                </span>
                {item.subtitle && (
                  <span className="block truncate text-xs text-muted-foreground">
                    {item.subtitle}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    );
  }
);
