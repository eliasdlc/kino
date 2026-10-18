import { useEffect, useState } from "react";
import type { Editor } from "@tiptap/react";

/**
 * Las palabras de un texto plano. Cuenta lo mismo que `countWords` sobre el
 * HTML (los bloques ya llegan separados por espacios), sin serializar nada.
 */
export function contarPalabras(texto: string): number {
  const limpio = texto.replace(/\s+/g, " ").trim();
  return limpio ? limpio.split(" ").length : 0;
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
      const { doc } = editor.state;
      setPalabras(contarPalabras(doc.textBetween(0, doc.content.size, " ", " ")));
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
