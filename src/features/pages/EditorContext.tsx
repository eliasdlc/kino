"use client";

import { createContext, useContext } from "react";
import { useEditor } from "@tiptap/react";
import type { Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Typography from "@tiptap/extension-typography";
import { Table, TableRow, TableHeader, TableCell } from "@tiptap/extension-table";
import { StickyAnchorMark } from "@/features/sticky-notes/sticky-anchor.extension";

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
      StarterKit,
      Typography,
      Placeholder.configure({ placeholder: "Empieza a escribir…" }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      StickyAnchorMark,
    ],
    content: initialContent,
    editorProps: {
      attributes: { class: "focus:outline-none min-h-[60vh] text-sm leading-7" },
    },
  });

  return <EditorContext.Provider value={editor}>{children}</EditorContext.Provider>;
}
