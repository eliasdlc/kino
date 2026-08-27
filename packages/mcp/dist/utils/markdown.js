import { marked } from 'marked';
/**
 * Convierte un string markdown a HTML compatible con el editor TipTap
 * del cliente. La salida se almacena tal cual en la columna `content`
 * de pages, que se valida como `z.string()`: cualquier HTML pasa.
 *
 * **Esto no sanea nada.** `marked` corre con su configuración por defecto y
 * no filtra `script`, `iframe` ni handlers inline. Quien filtra es el punto de
 * render: la app pinta `pages.content` por `src/shared/components/SanitizedHtml.tsx`,
 * el único sitio que lo inyecta, con la lista blanca de `src/shared/lib/sanitize.ts`.
 *
 * Saneando al pintar y no al guardar, las páginas que ya estaban escritas quedan
 * cubiertas también, y el editor sigue recibiendo el HTML íntegro para que su
 * parser de ProseMirror decida qué cabe en el schema.
 *
 * Devuelve null para inputs vacíos/nulos para preservar el contrato del API
 * (content nullable).
 */
export function markdownToHtml(input) {
    if (input == null)
        return null;
    if (input.trim() === '')
        return null;
    return marked.parse(input, { async: false });
}
