/**
 * Cuenta palabras del contenido Tiptap (HTML) de un manuscrito. Derivado del
 * contenido — nunca un contador persistido (D12: derivar > mantener). Se usa
 * para el progreso de palabras de una obra en el arquetipo Writing.
 */
export function countWords(html: string | null | undefined): number {
  if (!html) return 0;
  const text = html
    .replace(/<\/?(p|li|h[1-6]|br|div)[^>]*>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return 0;
  return text.split(/\s+/).length;
}
