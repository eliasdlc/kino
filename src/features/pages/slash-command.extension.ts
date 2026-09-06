import { Extension, ReactRenderer } from "@tiptap/react";
import Suggestion from "@tiptap/suggestion";
import { PluginKey } from "@tiptap/pm/state";
import type {
  SuggestionKeyDownProps,
  SuggestionProps,
} from "@tiptap/suggestion";
import type { Editor } from "@tiptap/react";
import {
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  ListTodo,
  Quote,
  Code,
  Table as TableIcon,
  Image as ImageIcon,
} from "lucide-react";
import { SlashMenu } from "./SlashMenu";
import type { SlashItem, SlashMenuProps, SlashMenuRef } from "./SlashMenu";
import { uploadImageFile } from "@/features/uploads/uploads.client";

/**
 * Abre el selector de archivos, comprime a WebP, sube y inserta la imagen
 * (Writing W2 / desbloquea el Rumbo 08 Sprint 3: upload real en el editor).
 */
function pickAndInsertImage(editor: Editor) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) return;
    try {
      const url = await uploadImageFile(file);
      editor.chain().focus().setImage({ src: url }).run();
    } catch {
      // best-effort: sin storage configurado, no se inserta nada.
    }
  };
  input.click();
}

/** Insertion blocks offered by the `/` menu. Image is wired in Sprint 3. */
const SLASH_ITEMS: SlashItem[] = [
  {
    title: "Título 1",
    subtitle: "Encabezado grande",
    icon: Heading1,
    keywords: ["h1", "titulo", "heading", "encabezado"],
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).toggleHeading({ level: 1 }).run(),
  },
  {
    title: "Título 2",
    subtitle: "Encabezado mediano",
    icon: Heading2,
    keywords: ["h2", "titulo", "heading", "encabezado"],
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).toggleHeading({ level: 2 }).run(),
  },
  {
    title: "Título 3",
    subtitle: "Encabezado chico",
    icon: Heading3,
    keywords: ["h3", "titulo", "heading", "encabezado"],
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).toggleHeading({ level: 3 }).run(),
  },
  {
    title: "Lista",
    subtitle: "Lista con viñetas",
    icon: List,
    keywords: ["bullet", "lista", "vinetas", "ul"],
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).toggleBulletList().run(),
  },
  {
    title: "Lista numerada",
    subtitle: "Lista ordenada",
    icon: ListOrdered,
    keywords: ["ordered", "numerada", "ol", "numeros"],
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).toggleOrderedList().run(),
  },
  {
    title: "Lista de tareas",
    subtitle: "Checkboxes",
    icon: ListTodo,
    keywords: ["todo", "tareas", "checkbox", "task"],
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).toggleTaskList().run(),
  },
  {
    title: "Cita",
    subtitle: "Bloque de cita",
    icon: Quote,
    keywords: ["quote", "cita", "blockquote"],
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).toggleBlockquote().run(),
  },
  {
    title: "Código",
    subtitle: "Bloque de código",
    icon: Code,
    keywords: ["code", "codigo", "pre"],
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).toggleCodeBlock().run(),
  },
  {
    title: "Tabla",
    subtitle: "Tabla 3×3 con encabezado",
    icon: TableIcon,
    keywords: ["table", "tabla", "grid"],
    command: ({ editor, range }) =>
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
        .run(),
  },
  {
    title: "Imagen",
    subtitle: "Subir una imagen",
    icon: ImageIcon,
    keywords: ["image", "imagen", "foto", "picture", "subir"],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).run();
      pickAndInsertImage(editor);
    },
  },
];

function getSlashItems(items: SlashItem[], query: string): SlashItem[] {
  const q = query.toLowerCase().trim();
  if (!q) return items;
  return items.filter(
    (item) =>
      item.title.toLowerCase().includes(q) ||
      item.keywords.some((k) => k.includes(q))
  );
}

/** Mounts SlashMenu in a fixed, caret-anchored popover with simple flip. */
function renderSlashMenu() {
  let renderer: ReactRenderer<SlashMenuRef, SlashMenuProps> | null = null;
  let el: HTMLDivElement | null = null;
  let hidden = false;

  const position = (clientRect?: (() => DOMRect | null) | null) => {
    if (!el || !clientRect) return;
    const rect = clientRect();
    if (!rect) return;
    const menuHeight = el.offsetHeight || 300;
    const spaceBelow = window.innerHeight - rect.bottom;
    const top =
      spaceBelow < menuHeight + 16 ? rect.top - menuHeight - 6 : rect.bottom + 6;
    el.style.position = "fixed";
    el.style.left = `${Math.round(rect.left)}px`;
    el.style.top = `${Math.round(Math.max(8, top))}px`;
    el.style.zIndex = "50";
  };

  return {
    onStart: (props: SuggestionProps<SlashItem, SlashItem>) => {
      renderer = new ReactRenderer(SlashMenu, {
        props: { items: props.items, command: props.command },
        editor: props.editor,
      });
      el = renderer.element as HTMLDivElement;
      document.body.appendChild(el);
      hidden = false;
      position(props.clientRect);
    },
    onUpdate: (props: SuggestionProps<SlashItem, SlashItem>) => {
      if (el && hidden) {
        document.body.appendChild(el);
        hidden = false;
      }
      renderer?.updateProps({ items: props.items, command: props.command });
      position(props.clientRect);
    },
    onKeyDown: (props: SuggestionKeyDownProps) => {
      if (props.event.key === "Escape") {
        el?.remove();
        hidden = true;
        return true;
      }
      return renderer?.ref?.onKeyDown(props) ?? false;
    },
    onExit: () => {
      el?.remove();
      el = null;
      renderer?.destroy();
      renderer = null;
    },
  };
}

/** Propia y distinta de la de las menciones del codex. */
const SLASH_COMMAND_KEY = new PluginKey("slashCommand");

export interface SlashCommandOptions {
  /**
   * Bloques propios del medium de la obra (W3), añadidos arriba del menú base:
   * un guion ofrece "Encabezado de escena", una novela "Separador de escena".
   */
  mediumItems: SlashItem[];
}

export const SlashCommand = Extension.create<SlashCommandOptions>({
  name: "slashCommand",

  addOptions() {
    return { mediumItems: [] };
  },

  addProseMirrorPlugins() {
    const options = this.options;
    return [
      Suggestion<SlashItem, SlashItem>({
        // Sin `pluginKey` las dos extensiones de sugerencia comparten la clave
        // por defecto y ProseMirror rechaza montar el editor. Ver la del codex.
        pluginKey: SLASH_COMMAND_KEY,
        editor: this.editor,
        char: "/",
        allowSpaces: false,
        startOfLine: false,
        // No `/` menu inside code blocks: there `/` is literal.
        allow: ({ editor }) => !editor.isActive("codeBlock"),
        items: ({ query }) =>
          getSlashItems([...options.mediumItems, ...SLASH_ITEMS], query),
        command: ({ editor, range, props }) =>
          props.command({ editor, range }),
        render: renderSlashMenu,
      }),
    ];
  },
});
