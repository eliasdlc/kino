"use client";

import type { Editor } from "@tiptap/react";
import { BubbleMenu, FloatingMenu } from "@tiptap/react/menus";
import { Table as TableIcon, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

const menuContainer =
  "flex items-center gap-1 bg-popover border border-border rounded-lg px-1.5 py-1 shadow-lg";
const menuButton =
  "flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors text-muted-foreground hover:text-foreground hover:bg-accent";

/**
 * Editor menus for tables (KIN-65):
 * - FloatingMenu on an empty paragraph → insert a 3×3 table with header row.
 * - BubbleMenu while the cursor is inside a table → add/remove rows & columns,
 *   toggle header row, delete table.
 *
 * Insertion will also be reachable from the slash menu (Sprint 2); the floating
 * affordance keeps Sprint 1 self-contained.
 */
export function TableMenus({ editor }: { editor: Editor }) {
  return (
    <>
      <FloatingMenu
        editor={editor}
        pluginKey="insertMenu"
        shouldShow={({ editor, state }) => {
          const { $from, empty } = state.selection;
          if (!empty) return false;
          const node = $from.parent;
          const isEmptyParagraph =
            node.type.name === "paragraph" && node.content.size === 0;
          return isEmptyParagraph && !editor.isActive("table");
        }}
      >
        <div className={menuContainer}>
          <button
            type="button"
            className={menuButton}
            title="Insertar tabla"
            onClick={() =>
              editor
                .chain()
                .focus()
                .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
                .run()
            }
          >
            <TableIcon className="size-3" />
            Tabla
          </button>
        </div>
      </FloatingMenu>

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
    </>
  );
}
