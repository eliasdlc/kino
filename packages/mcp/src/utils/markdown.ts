import { marked } from 'marked';

/**
 * Convierte un string markdown a HTML compatible con el editor TipTap
 * del cliente. La salida se almacena tal cual en la columna `content`
 * de pages, que se valida como `z.string()`: cualquier HTML pasa.
 *
 * **Esto no sanea nada.** `marked` corre con su configuración por defecto y
 * no filtra `script`, `iframe` ni handlers inline. Que el editor cargue el
 * contenido por el parser de ProseMirror, que sí descarta lo que no está en
 * su schema, protege al editor y sólo al editor: hay dos vistas de lectura
 * que pintan `pages.content` crudo sin pasar por ahí.
 *
 * - `src/features/writing/ReadingView.tsx`
 * - `src/features/writing/ChapterHistory.tsx`
 *
 * Las dos usan `dangerouslySetInnerHTML`. La sanitización de verdad tiene que
 * vivir en el punto de render, y hoy no existe.
 *
 * Devuelve null para inputs vacíos/nulos para preservar el contrato del API
 * (content nullable).
 */
export function markdownToHtml(input: string | null | undefined): string | null {
  if (input == null) return null;
  if (input.trim() === '') return null;
  return marked.parse(input, { async: false });
}
