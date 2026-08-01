"use client";

import { createContext, useContext } from "react";
import { useEditor } from "@tiptap/react";
import type { Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Typography from "@tiptap/extension-typography";
import Focus from "@tiptap/extension-focus";
import { Table, TableRow, TableHeader, TableCell } from "@tiptap/extension-table";
import { TaskList, TaskItem } from "@tiptap/extension-list";
import { StickyAnchorMark } from "@/features/sticky-notes/sticky-anchor.extension";
import { SlashCommand } from "./slash-command.extension";
import { ImageUrlPaste } from "./image-paste.extension";
import { CodexMention } from "./codex-mention.extension";
import { mediumExtensions } from "./mediums/medium-extensions";
import { mediumSlashItems } from "./mediums/medium-blocks";
import { cleanPastedHtml } from "./paste-clean";
import type { MediumManifest } from "@/shared/lib/mediums";

const EditorContext = createContext<Editor | null>(null);

export function useSharedEditor() {
  return useContext(EditorContext);
}

export function EditorProvider({
  initialContent,
  codex = null,
  medium = null,
  children,
}: {
  initialContent: string;
  /** Arquetipo Writing: activa la mención `@` del Codex sobre este sistema/universo. */
  codex?: { systemId: string } | null;
  /** Medium de la obra (W3): monta sus nodos, su slash menu y su teclado. */
  medium?: MediumManifest | null;
  children: React.ReactNode;
}) {
  const editor = useEditor({
    extensions: [
      // Markdown input rules (`# `, `- `, `> `, ```, `**bold**`, …) ship enabled
      // with StarterKit. Headings are capped at 1–3 to match the styled range
      // (globals.css) and the slash menu, so `#### ` never makes an unstyled h4.
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Typography,
      // Marca el bloque de nivel superior que contiene el cursor con `.has-focus`.
      // El modo focus del arquetipo Writing (PLAN-11 §7) usa esa clase para atenuar
      // todo menos el párrafo activo. Inerte fuera del modo focus.
      Focus.configure({ className: "has-focus", mode: "shallowest" }),
      Placeholder.configure({
        placeholder: medium?.placeholder ?? "Empieza a escribir…",
      }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      TaskList,
      TaskItem.configure({ nested: true }),
      ImageUrlPaste.configure({
        HTMLAttributes: { class: "rounded-lg max-w-full h-auto my-2" },
      }),
      SlashCommand.configure({ mediumItems: mediumSlashItems(medium) }),
      StickyAnchorMark,
      ...(codex
        ? [CodexMention.configure({ systemId: codex.systemId, HTMLAttributes: {} })]
        : []),
      ...mediumExtensions(medium),
    ],
    content: initialContent,
    editorProps: {
      attributes: { class: "focus:outline-none min-h-[60vh] text-sm leading-7" },
      transformPastedHTML: (html) => cleanPastedHtml(html),
    },
  });

  return <EditorContext.Provider value={editor}>{children}</EditorContext.Provider>;
}
