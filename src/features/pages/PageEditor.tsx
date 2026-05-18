"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Typography from "@tiptap/extension-typography";
import { useUpdatePage } from "./pages.hooks";
import type { PageDetail } from "./pages.types";

interface PageEditorProps {
  page: PageDetail;
  systemId: string;
}

export function PageEditor({ page, systemId }: PageEditorProps) {
  const { mutate: updatePage } = useUpdatePage(page.id, systemId);
  const [title, setTitle] = useState(page.title ?? "");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPatch = useRef<{ title?: string; content?: string } | null>(null);

  const scheduleSave = useCallback(
    (patch: { title?: string; content?: string }) => {
      pendingPatch.current = { ...pendingPatch.current, ...patch };
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        updatePage(pendingPatch.current!);
        pendingPatch.current = null;
      }, 1500);
    },
    [updatePage]
  );

  const editor = useEditor({
    extensions: [
      StarterKit,
      Typography,
      Placeholder.configure({ placeholder: "Start writing…" }),
    ],
    content: page.content ?? "",
    editorProps: {
      attributes: {
        class: "focus:outline-none min-h-[60vh] text-sm leading-7",
      },
    },
    onUpdate: ({ editor: e }) => {
      scheduleSave({ content: e.getHTML() });
    },
  });

  useEffect(() => {
    return () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        if (pendingPatch.current) updatePage(pendingPatch.current);
      }
    };
  }, [updatePage]);

  function handleTitleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setTitle(e.target.value);
    scheduleSave({ title: e.target.value || undefined });
  }

  return (
    <div className="flex flex-col gap-4 h-full">
      <input
        type="text"
        value={title}
        onChange={handleTitleChange}
        placeholder="Untitled"
        className="w-full bg-transparent text-3xl font-bold placeholder:text-muted-foreground/40 focus:outline-none border-none p-0"
        maxLength={500}
      />
      <div className="tiptap-editor flex-1">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
