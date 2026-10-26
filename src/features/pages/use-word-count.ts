import { useEffect, useState } from "react";
import type { Editor } from "@tiptap/react";
import type { Node as PMNode } from "@tiptap/pm/model";

/**
 * Las palabras de un texto plano. Cuenta lo mismo que `countWords` sobre el
 * HTML (los bloques ya llegan separados por espacios), sin serializar nada.
 */
export function contarPalabras(texto: string): number {
  const limpio = texto.replace(/\s+/g, " ").trim();
  return limpio ? limpio.split(" ").length : 0;
}

/**
 * El texto plano de un documento para contarlo. Un salto de línea o un corte de
 * escena separa palabras; una mención del códice es una palabra más (`@Inés`),
 * pegada a lo que la rodea igual que en el HTML.
 */
export function textoParaContar(doc: PMNode): string {
  return doc.textBetween(0, doc.content.size, " ", (hoja) =>
    hoja.type.name === "codexMention" ? `@${hoja.attrs.label ?? ""}` : " ",
  );
}

/** Pausa tras la última tecla antes de recontar. */
const PAUSA_MS = 250;

/**
 * Las palabras del documento abierto, una sola cuenta por pausa.
 *
 * Antes la barra de estado pedía el HTML entero al editor y lo pasaba por
 * cinco expresiones regulares en cada tecla. Aquí se lee el texto del
 * documento (sin HTML) y sólo cuando se deja de teclear un cuarto de segundo:
 * la cifra llega igual de viva para quien la mira entre frases, y teclear deja
 * de pagar un recorrido completo por letra.
 */
export function useWordCount(editor: Editor | null): number {
  const [palabras, setPalabras] = useState(0);

  useEffect(() => {
    if (!editor) return;
    let pendiente: ReturnType<typeof setTimeout> | null = null;
    const contar = () => {
      pendiente = null;
      if (editor.isDestroyed) return;
      setPalabras(contarPalabras(textoParaContar(editor.state.doc)));
    };
    const programar = () => {
      if (pendiente) clearTimeout(pendiente);
      pendiente = setTimeout(contar, PAUSA_MS);
    };
    contar();
    editor.on("update", programar);
    return () => {
      editor.off("update", programar);
      if (pendiente) clearTimeout(pendiente);
    };
  }, [editor]);

  return palabras;
}
