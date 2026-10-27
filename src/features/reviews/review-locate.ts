import type { Node as PmNode } from "@tiptap/pm/model";
import { locateQuote, normalizeForMatch, type TextQuote } from "@/shared/lib/text-quote";

/**
 * El texto de un documento de ProseMirror, con la posición de cada carácter.
 *
 * Es la proyección sobre la que se busca una cita: un blanco entre bloques,
 * como en el HTML que lee el servidor, y para cada índice del texto la
 * posición del documento donde vive. Un nodo en línea sin texto (una imagen,
 * una mención) cuenta como un blanco para que dos palabras no se peguen.
 */
export interface DocText {
  text: string;
  positions: number[];
}

export function docText(doc: PmNode): DocText {
  let text = "";
  const positions: number[] = [];
  doc.descendants((node, pos) => {
    if (node.isText) {
      const value = node.text ?? "";
      for (let i = 0; i < value.length; i++) positions.push(pos + i);
      text += value;
      return false;
    }
    if (node.isBlock || (node.isInline && node.isLeaf)) {
      if (text.length > 0 && !text.endsWith(" ")) {
        text += " ";
        positions.push(pos);
      }
    }
    return undefined;
  });
  return { text, positions };
}

export interface DocRange {
  from: number;
  to: number;
}

/** Dónde está la cita en el documento, o `null` si no está o no se puede saber sin adivinar. */
export function locateInDoc(projection: DocText, quote: TextQuote): DocRange | null {
  const match = locateQuote(projection.text, quote);
  if (match.status !== "found") return null;
  const from = projection.positions[match.start];
  const last = projection.positions[match.end - 1];
  if (from === undefined || last === undefined) return null;
  return { from, to: last + 1 };
}

/** Si el trozo que hay ahora en `range` sigue diciendo lo que la cita citó. */
export function rangeSaysQuote(doc: PmNode, range: DocRange, quote: string): boolean {
  const actual = doc.textBetween(range.from, range.to, " ", " ");
  return normalizeForMatch(actual).text === normalizeForMatch(quote).text;
}

/** Las palabras de alrededor de una selección, para que una cita repetida se ancle a la suya. */
export function contextAround(doc: PmNode, range: DocRange, size = 32): { prefix: string; suffix: string } {
  const prefix = doc.textBetween(Math.max(0, range.from - size), range.from, " ", " ");
  const suffix = doc.textBetween(range.to, Math.min(doc.content.size, range.to + size), " ", " ");
  return { prefix, suffix };
}
