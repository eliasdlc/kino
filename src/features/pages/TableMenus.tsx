"use client";

import type { Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { BUBBLE, BUBBLE_BUTTON } from "./bubble-styles";

/**
 * Las operaciones de una tabla (KIN-65), en un menú que aparece mientras el
 * cursor está dentro: filas, columnas, la fila de encabezado y borrarla.
 * Insertar una tabla vive en el menú `/` (KIN-67).
 *
 * Arriba de la tabla, como el menú de la selección: en un teléfono lo de abajo
 * es el teclado. Cada operación dice lo que hace con una palabra, sin signos
 * sueltos, y en un dedo mide 48 px; la fila entera se desplaza en horizontal
 * si no cabe, en vez de partirse. El desplazamiento vive en una fila interior:
 * el globo con su sombra queda entero.
 */
export function TableMenus({ editor }: { editor: Editor }) {
  const correr = (accion: (cadena: ReturnType<Editor["chain"]>) => ReturnType<Editor["chain"]>) =>
    accion(editor.chain().focus()).run();

  return (
    <BubbleMenu
      editor={editor}
      pluginKey="tableMenu"
      shouldShow={({ editor }) => editor.isActive("table")}
      options={{ placement: "top" }}
    >
      <div role="toolbar" aria-label="Tabla" className={cn(BUBBLE, "max-w-[calc(100vw-1rem)]")}>
        <div className="flex min-w-0 items-center gap-0.5 overflow-x-auto">
          <button type="button" className={BUBBLE_BUTTON} onClick={() => correr((c) => c.addRowAfter())}>
            Añadir fila
          </button>
          <button type="button" className={BUBBLE_BUTTON} onClick={() => correr((c) => c.deleteRow())}>
            Quitar fila
          </button>
          <span aria-hidden className="mx-0.5 h-4 w-px shrink-0 bg-border" />
          <button type="button" className={BUBBLE_BUTTON} onClick={() => correr((c) => c.addColumnAfter())}>
            Añadir columna
          </button>
          <button type="button" className={BUBBLE_BUTTON} onClick={() => correr((c) => c.deleteColumn())}>
            Quitar columna
          </button>
          <span aria-hidden className="mx-0.5 h-4 w-px shrink-0 bg-border" />
          <button type="button" className={BUBBLE_BUTTON} onClick={() => correr((c) => c.toggleHeaderRow())}>
            Encabezado
          </button>
          <button
            type="button"
            aria-label="Borrar la tabla"
            className={cn(BUBBLE_BUTTON, "hover:text-destructive")}
            onClick={() => correr((c) => c.deleteTable())}
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>
    </BubbleMenu>
  );
}
