"use client";

import type { Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

const menuContainer =
  "flex items-center gap-1 bg-popover border border-border rounded-lg px-1.5 py-1 shadow-lg";
const menuButton =
  "flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors text-muted-foreground hover:text-foreground hover:bg-accent";

/**
 * Contextual table toolbar (KIN-65): a BubbleMenu shown while the cursor is
 * inside a table — add/remove rows & columns, toggle header row, delete table.
 * Table insertion lives in the slash menu (KIN-67).
 */
export function TableMenus({ editor }: { editor: Editor }) {
  return (
    <BubbleMenu
      editor={editor}
      pluginKey="tableMenu"
      shouldShow={({ editor }) => editor.isActive("table")}
      options={{ placement: "top" }}
    >
      <div className={menuContainer}>
          <button
            type="button"
            className={menuButton}
            title="Añadir fila debajo"
            onClick={() => editor.chain().focus().addRowAfter().run()}
          >
            Fila +
          </button>
          <button
            type="button"
            className={menuButton}
            title="Borrar fila"
            onClick={() => editor.chain().focus().deleteRow().run()}
          >
            Fila −
          </button>
          <span className="w-px h-4 bg-border" />
          <button
            type="button"
            className={menuButton}
            title="Añadir columna a la derecha"
            onClick={() => editor.chain().focus().addColumnAfter().run()}
          >
            Col +
          </button>
          <button
            type="button"
            className={menuButton}
            title="Borrar columna"
            onClick={() => editor.chain().focus().deleteColumn().run()}
          >
            Col −
          </button>
          <span className="w-px h-4 bg-border" />
          <button
            type="button"
            className={menuButton}
            title="Alternar fila de encabezado"
            onClick={() => editor.chain().focus().toggleHeaderRow().run()}
          >
            Header
          </button>
          <button
            type="button"
            className={cn(menuButton, "hover:text-destructive")}
            title="Borrar tabla"
            onClick={() => editor.chain().focus().deleteTable().run()}
          >
            <Trash2 className="size-3" />
          </button>
        </div>
    </BubbleMenu>
  );
}
