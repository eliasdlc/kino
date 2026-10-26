/**
 * Criterio: la cuenta en vivo de la barra de estado es la misma que el servidor
 * saca del HTML, también con menciones del códice, que son nodos sin texto propio.
 */
import { describe, expect, it } from "vitest";
import { useEffect } from "react";
import { render, waitFor } from "@testing-library/react";
import type { Editor } from "@tiptap/react";
import { countWords } from "@/shared/lib/word-count";
import { EditorProvider, useSharedEditor } from "./EditorContext";
import { contarPalabras, textoParaContar } from "./use-word-count";

const mencion = (id: string, nombre: string) =>
  `<span data-mention="" class="codex-mention" data-entity-id="${id}" data-label="${nombre}">@${nombre}</span>`;

const CASOS = {
  "una mención entre palabras": `<p>Ayer ${mencion("e1", "Inés")} subió a la loma</p>`,
  "dos menciones pegadas": `<p>${mencion("e1", "Inés")}${mencion("e2", "Tomás")}llegaron</p>`,
  "un salto de línea": "<p>uno<br>dos tres</p>",
  "una lista": "<ul><li><p>uno dos</p></li><li><p>tres</p></li></ul>",
};

function Agarrar({ alTener }: { alTener: (editor: Editor) => void }) {
  const editor = useSharedEditor();
  useEffect(() => {
    if (editor) alTener(editor);
  }, [editor, alTener]);
  return null;
}

describe("textoParaContar", () => {
  for (const [nombre, html] of Object.entries(CASOS)) {
    it(`da lo que countWords del HTML con ${nombre}`, async () => {
      let editor: Editor | null = null;
      render(
        <EditorProvider initialContent={html} codex={{ systemId: "s" }}>
          <Agarrar alTener={(e) => (editor = e)} />
        </EditorProvider>,
      );
      await waitFor(() => expect(editor).not.toBeNull());
      const vivo = editor as unknown as Editor;
      expect(contarPalabras(textoParaContar(vivo.state.doc))).toBe(countWords(vivo.getHTML()));
    });
  }
});
