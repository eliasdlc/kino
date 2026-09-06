import { marked } from 'marked';
import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';

/** Turndown se construye una vez: sus reglas no dependen de la página. */
let service: TurndownService | null = null;

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
export function markdownToHtml(input: string | null | undefined): string | null {
  if (input == null) return null;
  if (input.trim() === '') return null;
  return marked.parse(input, { async: false });
}

/**
 * El viaje de vuelta: el HTML guardado, otra vez en markdown.
 *
 * Sin esto el round trip está a medias: el agente escribe markdown, la página
 * guarda HTML, y al leerla recibiría HTML que al reescribir acabaría anidado
 * dentro de más HTML. Lo que sale de aquí es lo que el agente puede editar y
 * devolver por `update_page` sin que el documento se degrade en cada pasada.
 *
 * Dos orígenes distintos producen el HTML que hay que revertir: `marked`, cuando
 * lo escribió el propio agente, y Tiptap, cuando lo escribió una persona en el
 * editor. Sus listas de tareas no se parecen (`input[type=checkbox]` una,
 * `li[data-checked]` la otra), así que se cubren las dos.
 *
 * Lo que **no** hace es la serialización por medium del arquetipo Writing
 * (Fountain, páginas y paneles de manga), que vive en el export de la app y sabe
 * de qué obra es cada página. Aquí se habla markdown a secas.
 */
function converter(): TurndownService {
  if (service) return service;

  const td = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    bulletListMarker: '-',
  });
  // Tablas, tachado y listas de tareas de GFM. Sin esto una tabla vuelve
  // aplanada a texto corrido y el agente la da por perdida.
  td.use(gfm);

  // Las listas de tareas de Tiptap no llevan checkbox: llevan el estado en el
  // atributo, y la regla de GFM no las ve.
  td.addRule('tiptapTaskItem', {
    filter: (node) => node.nodeName === 'LI' && node.hasAttribute('data-checked'),
    replacement: (content, node) => {
      const checked = (node as HTMLElement).getAttribute('data-checked') === 'true';
      return `- [${checked ? 'x' : ' '}] ${content.trim()}\n`;
    },
  });

  service = td;
  return td;
}

/**
 * Devuelve null para contenido vacío, igual que `markdownToHtml`: la columna
 * `content` es nullable y una página en blanco no es una cadena vacía.
 */
export function htmlToMarkdown(html: string | null | undefined): string | null {
  if (html == null) return null;
  const markdown = converter().turndown(html).trim();
  return markdown === '' ? null : markdown;
}
