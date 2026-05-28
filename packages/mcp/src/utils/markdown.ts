import { marked } from 'marked';

/**
 * Convierte un string markdown a HTML compatible con el editor TipTap
 * del cliente. La salida se almacena tal cual en la columna `content`
 * de pages — TipTap parsea el HTML al cargar la página.
 *
 * El render en el cliente pasa por el parser de ProseMirror, que descarta
 * nodos fuera del schema (script, iframe, handlers), actuando como
 * sanitizador implícito. No se inyecta HTML crudo con dangerouslySetInnerHTML.
 *
 * Devuelve null para inputs vacíos/nulos para preservar el contrato del API
 * (content nullable).
 */
export function markdownToHtml(input: string | null | undefined): string | null {
  if (input == null) return null;
  if (input.trim() === '') return null;
  return marked.parse(input, { async: false });
}
