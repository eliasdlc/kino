"use client";

import { useEffect, useRef, useState } from "react";
import { useEditorState, type Editor } from "@tiptap/react";
import {
  AtSign,
  Bold,
  Ellipsis,
  Heading2,
  Italic,
  List,
  Slash,
  StickyNote,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTecladoAbierto } from "@/hooks/use-teclado-abierto";
import { viewportVisual } from "./caret-popover";
import { useTecladoInset } from "./use-teclado-inset";

/**
 * La barra del pulgar: el formato del editor pegado encima del teclado del
 * teléfono. En un dedo no hay atajos ni menú de selección cómodo, así que lo
 * que se usa escribiendo vive aquí, a 48 px cada botón y al alcance del
 * pulgar: negrita, cursiva, título, lista (o la mención del codex en una
 * obra), el menú de bloques, la nota adhesiva y Más, que abre el panel con el
 * resto (sesión, estado del capítulo, índice, exportar).
 *
 * Sólo existe con el teclado abierto y el cursor en el texto: con el teclado
 * cerrado el pie de la app vuelve a su sitio y la barra sobraría. Sube con el
 * teclado leyendo el viewport visual, y cada vez que el cursor se mueve mira
 * que la línea no quede debajo de ella: si queda, desplaza el texto lo justo.
 *
 * Los botones no se quedan el foco (`pointerdown` sin acción por defecto):
 * tocarlos no cierra el teclado ni mueve el cursor.
 */

/** Alto de la barra: un botón de 2.85rem más su canto. */
const ALTO_BARRA_REM = 3.3;
/** Aire entre la línea que se escribe y el borde de arriba de la barra. */
const AIRE_PX = 12;

type Accion = {
  id: string;
  label: string;
  icon: LucideIcon;
  activo?: boolean;
  run: () => void;
};

export function EditorThumbBar({
  editor,
  mention = false,
  onNote,
  onMore,
  forceVisible = false,
}: {
  editor: Editor;
  /** Una obra con codex: la mención `@` ocupa el sitio de la lista. */
  mention?: boolean;
  onNote: () => void;
  onMore: () => void;
  /** El catálogo la enseña sin teclado. */
  forceVisible?: boolean;
}) {
  const tecladoAbierto = useTecladoAbierto();
  const inset = useTecladoInset();
  const [enTexto, setEnTexto] = useState(() => editor.isFocused);
  const barra = useRef<HTMLDivElement>(null);
  const visible = forceVisible || (tecladoAbierto && enTexto);

  const estado = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      heading: e.isActive("heading", { level: 2 }),
      list: e.isActive("bulletList"),
    }),
  });

  useEffect(() => {
    const entrar = () => setEnTexto(true);
    const salir = () => setEnTexto(false);
    editor.on("focus", entrar);
    editor.on("blur", salir);
    return () => {
      editor.off("focus", entrar);
      editor.off("blur", salir);
    };
  }, [editor]);

  // La línea que se escribe queda siempre por encima de la barra.
  useEffect(() => {
    if (!visible || forceVisible) return;
    const vigilar = () => {
      const alto = barra.current?.offsetHeight ?? 0;
      if (!alto || editor.isDestroyed) return;
      const { from } = editor.state.selection;
      const cursor = editor.view.coordsAtPos(from);
      const vv = viewportVisual();
      const techo = vv.offsetTop + vv.height - alto - AIRE_PX;
      const exceso = cursor.bottom - techo;
      if (exceso > 0) desplazable(editor.view.dom).scrollBy({ top: exceso });
    };
    editor.on("selectionUpdate", vigilar);
    editor.on("update", vigilar);
    return () => {
      editor.off("selectionUpdate", vigilar);
      editor.off("update", vigilar);
    };
  }, [editor, visible, forceVisible]);

  if (!visible) return null;

  const cadena = () => editor.chain().focus();
  const acciones: Accion[] = [
    { id: "bold", label: "Negrita", icon: Bold, activo: estado.bold, run: () => cadena().toggleBold().run() },
    { id: "italic", label: "Cursiva", icon: Italic, activo: estado.italic, run: () => cadena().toggleItalic().run() },
    {
      id: "heading",
      label: "Título",
      icon: Heading2,
      activo: estado.heading,
      run: () => cadena().toggleHeading({ level: 2 }).run(),
    },
    mention
      ? { id: "mention", label: "Mencionar del codex", icon: AtSign, run: () => insertarDisparador(editor, "@") }
      : { id: "list", label: "Lista", icon: List, activo: estado.list, run: () => cadena().toggleBulletList().run() },
    { id: "slash", label: "Insertar bloque", icon: Slash, run: () => insertarDisparador(editor, "/") },
    { id: "note", label: "Nota adhesiva", icon: StickyNote, run: onNote },
  ];

  return (
    <div
      ref={barra}
      role="toolbar"
      aria-label="Formato"
      data-slot="editor-thumb-bar"
      className={cn(
        "inset-x-0 bottom-0 z-(--z-overlay) flex items-center justify-between border-t border-border bg-background px-[max(0.5rem,env(safe-area-inset-left))] md:hidden",
        forceVisible ? "relative" : "fixed",
        inset === 0 && "pb-[env(safe-area-inset-bottom)]",
      )}
      style={{
        minHeight: `${ALTO_BARRA_REM}rem`,
        transform: inset > 0 ? `translateY(-${inset}px)` : undefined,
      }}
    >
      {acciones.map((accion) => (
        <BotonBarra key={accion.id} accion={accion} />
      ))}
      <span aria-hidden className="mx-0.5 h-6 w-px shrink-0 bg-border" />
      <BotonBarra accion={{ id: "more", label: "Más", icon: Ellipsis, run: onMore }} />
    </div>
  );
}

function BotonBarra({ accion }: { accion: Accion }) {
  const Icon = accion.icon;
  const conmutable = accion.activo !== undefined;
  return (
    <button
      type="button"
      aria-label={accion.label}
      aria-pressed={conmutable ? accion.activo : undefined}
      // Sin acción por defecto el botón no roba el foco: el teclado sigue
      // abierto y el cursor donde estaba.
      onPointerDown={(e) => e.preventDefault()}
      onMouseDown={(e) => e.preventDefault()}
      onClick={accion.run}
      className={cn(
        "press flex size-[2.85rem] shrink-0 items-center justify-center rounded-full transition-[color,background-color,transform] duration-(--dur-toque) ease-(--ease-pluma) focus-ring",
        accion.activo ? "bg-foreground text-background" : "text-foreground hover:bg-secondary",
      )}
    >
      <Icon className="size-5" strokeWidth={accion.activo ? 2.2 : 1.8} />
    </button>
  );
}

/**
 * Escribe el carácter que abre un menú (`/` o `@`) donde está el cursor. La
 * mención sólo se abre tras un espacio o al empezar la línea, así que si lo de
 * antes es una letra se pone el espacio primero.
 */
export function insertarDisparador(editor: Editor, caracter: "/" | "@") {
  const { from } = editor.state.selection;
  const antes = from > 1 ? editor.state.doc.textBetween(from - 1, from, "\n", "\n") : "";
  const necesitaEspacio = antes !== "" && !/\s/.test(antes);
  editor.chain().focus().insertContent(necesitaEspacio ? ` ${caracter}` : caracter).run();
}

/** El contenedor que de verdad se desplaza: el más cercano con scroll, o la ventana. */
function desplazable(desde: HTMLElement): Pick<Window, "scrollBy"> {
  let nodo: HTMLElement | null = desde.parentElement;
  while (nodo) {
    const { overflowY } = getComputedStyle(nodo);
    if ((overflowY === "auto" || overflowY === "scroll") && nodo.scrollHeight > nodo.clientHeight) {
      return nodo;
    }
    nodo = nodo.parentElement;
  }
  return window;
}
