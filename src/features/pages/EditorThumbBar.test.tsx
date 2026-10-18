/**
 * Criterio: la barra del pulgar formatea sin cerrar el teclado. Cada botón
 * dice su estado con `aria-pressed`, tocarlo no le quita el foco al texto
 * (el `pointerdown` no hace su acción por defecto), Nota y Más llaman a quien
 * abre la nota y el panel, y la mención pone su espacio delante si hace falta.
 * Sin teclado abierto la barra no existe, y la que enseña el catálogo se
 * queda en su sitio aunque el viewport visual mida menos que la ventana.
 */
import { useEffect } from "react";
import { describe, expect, it, vi } from "vitest";
import { act, createEvent, fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Editor } from "@tiptap/react";
import { renderMobile } from "@/shared/testing/render";
import { EditorProvider, useSharedEditor } from "./EditorContext";
import { EditorThumbBar, insertarDisparador } from "./EditorThumbBar";

function Barra({
  forceVisible,
  onNote,
  onMore,
  onEditor,
}: {
  forceVisible: boolean;
  onNote: () => void;
  onMore: () => void;
  onEditor?: (editor: Editor) => void;
}) {
  const editor = useSharedEditor();
  useEffect(() => {
    if (editor) onEditor?.(editor);
  }, [editor, onEditor]);
  if (!editor) return null;
  return <EditorThumbBar editor={editor} onNote={onNote} onMore={onMore} forceVisible={forceVisible} />;
}

function pintar(forceVisible = true) {
  const onNote = vi.fn();
  const onMore = vi.fn();
  let editor: Editor | null = null;
  renderMobile(
    <EditorProvider initialContent="<p>Inés subió a la loma</p>">
      <Barra forceVisible={forceVisible} onNote={onNote} onMore={onMore} onEditor={(e) => (editor = e)} />
    </EditorProvider>,
  );
  return { onNote, onMore, editorDe: () => editor! };
}

describe("EditorThumbBar", () => {
  it("sin teclado abierto y sin foco en el texto no se pinta", async () => {
    pintar(false);
    await waitFor(() => expect(screen.queryByRole("toolbar", { name: "Formato" })).not.toBeInTheDocument());
  });

  it("negrita se enciende sobre lo seleccionado y lo dice con aria-pressed", async () => {
    const { editorDe } = pintar();
    const negrita = await screen.findByRole("button", { name: "Negrita" });
    expect(negrita).toHaveAttribute("aria-pressed", "false");
    act(() => {
      editorDe().commands.setTextSelection({ from: 1, to: 5 });
    });
    await userEvent.click(negrita);
    expect(editorDe().getHTML()).toContain("<strong>Inés</strong>");
    expect(negrita).toHaveAttribute("aria-pressed", "true");
  });

  it("tocar un botón no le roba el foco al texto", async () => {
    pintar();
    const cursiva = await screen.findByRole("button", { name: "Cursiva" });
    const evento = createEvent.pointerDown(cursiva);
    fireEvent(cursiva, evento);
    expect(evento.defaultPrevented).toBe(true);
  });

  it("Nota y Más llaman a quien abre la nota y el panel", async () => {
    const { onNote, onMore } = pintar();
    await userEvent.click(await screen.findByRole("button", { name: "Nota adhesiva" }));
    await userEvent.click(screen.getByRole("button", { name: "Más" }));
    expect(onNote).toHaveBeenCalledOnce();
    expect(onMore).toHaveBeenCalledOnce();
  });

  it("la mención pone un espacio delante si lo de antes es una letra", async () => {
    const { editorDe } = pintar();
    await screen.findByRole("toolbar", { name: "Formato" });
    act(() => {
      editorDe().commands.setTextSelection(5);
      insertarDisparador(editorDe(), "@");
    });
    expect(editorDe().state.doc.textContent).toBe("Inés @ subió a la loma");
  });

  it("la barra del catálogo no sube con un viewport visual más bajo que la ventana", async () => {
    const original = window.visualViewport;
    const falso = Object.assign(new EventTarget(), { height: window.innerHeight - 300, offsetTop: 0 });
    Object.defineProperty(window, "visualViewport", { configurable: true, value: falso });
    try {
      pintar();
      const barra = await screen.findByRole("toolbar", { name: "Formato" });
      expect(barra.style.transform).toBe("");
    } finally {
      Object.defineProperty(window, "visualViewport", { configurable: true, value: original });
    }
  });
});
