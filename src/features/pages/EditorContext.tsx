"use client";

import { createContext, useContext } from "react";
import { useEditor } from "@tiptap/react";
import type { Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Typography from "@tiptap/extension-typography";
import { Table, TableRow, TableHeader, TableCell } from "@tiptap/extension-table";
import { TaskList, TaskItem } from "@tiptap/extension-list";
import { StickyAnchorMark } from "@/features/sticky-notes/sticky-anchor.extension";
import { SlashCommand } from "./slash-command.extension";
import { cleanPastedHtml } from "./paste-clean";

const EditorContext = createContext<Editor | null>(null);

export function useSharedEditor() {
  return useContext(EditorContext);
}

export function EditorProvider({
  initialContent,
  children,
}: {
  initialContent: string;
  children: React.ReactNode;
}) {
  const editor = useEditor({
    extensions: [
      // Markdown input rules (`# `, `- `, `> `, ```, `**bold**`, …) ship enabled
      // with StarterKit. Headings are capped at 1–3 to match the styled range
      // (globals.css) and the slash menu, so `#### ` never makes an unstyled h4.
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Typography,
      Placeholder.configure({ placeholder: "Empieza a escribir…" }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      TaskList,
      TaskItem.configure({ nested: true }),
      SlashCommand,
      StickyAnchorMark,
    ],
    content: initialContent,
    editorProps: {
      attributes: { class: "focus:outline-none min-h-[60vh] text-sm leading-7" },
      transformPastedHTML: (html) => cleanPastedHtml(html),
    },
  });

  return <EditorContext.Provider value={editor}>{children}</EditorContext.Provider>;
}
