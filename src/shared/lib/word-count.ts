/**
 * Cuenta palabras del contenido Tiptap (HTML) de un manuscrito. Derivado del
 * contenido: nunca un contador persistido (D12: derivar > mantener). Se usa
 * para el progreso de palabras de una obra en el arquetipo Writing.
 */
export function countWords(html: string | null | undefined): number {
  if (!html) return 0;
  const text = html
    .replace(/<\/?(p|li|h[1-6]|br|div)[^>]*>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&[a-z]+;/gi, " ");
  return countPlainWords(text);
}

/**
 * Las palabras de un texto ya sin etiquetas. `&`, `<` y `>` separan palabras:
 * en el HTML son las entidades que `countWords` reemplaza por un espacio, así
 * que el texto plano de un documento abierto (donde ya son los caracteres) debe
 * pasar por aquí para dar la misma cifra que el servidor.
 */
export function countPlainWords(text: string): number {
  const limpio = text.replace(/[&<>]/g, " ").replace(/\s+/g, " ").trim();
  return limpio ? limpio.split(" ").length : 0;
}
