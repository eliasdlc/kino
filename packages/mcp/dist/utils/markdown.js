import { marked } from 'marked';
import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';
const turndown = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    bulletListMarker: '-',
});
turndown.use(gfm);
turndown.addRule('tiptapTaskListItem', {
    filter: (node) => node.nodeName === 'LI' &&
        node.querySelector('input[type="checkbox"]') !== null,
    replacement: (content, node) => {
        const checkbox = node.querySelector('input[type="checkbox"]');
        const text = content.replace(/^\s*\[[x ]\]\s*/i, '').trim();
        return `- [${checkbox?.checked ? 'x' : ' '}] ${text}\n`;
    },
});
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
export function markdownToHtml(input) {
    if (input == null)
        return null;
    if (input.trim() === '')
        return null;
    return marked.parse(input, { async: false });
}
/** Converts stored Tiptap HTML into the Markdown contract exposed by MCP. */
export function htmlToMarkdown(input) {
    if (input == null)
        return null;
    if (input.trim() === '')
        return null;
    return turndown.turndown(input);
}
