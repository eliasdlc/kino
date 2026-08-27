import sanitizeHtml from "sanitize-html";

/**
 * Sanea el HTML de `pages.content` antes de pintarlo.
 *
 * El contenido de una página se guarda como HTML y ya no lo produce sólo el
 * editor: el MCP escribe páginas convirtiendo Markdown con `marked`, que deja
 * pasar el HTML embebido tal cual. Un agente que lee un texto ajeno puede acabar
 * guardando una etiqueta con `onerror`, y las vistas de lectura la inyectan en el
 * origen de la app con la sesión del usuario puesta.
 *
 * El editor no protege esas vistas: el parser de ProseMirror descarta lo que no
 * está en su schema, pero eso pasa al *cargar* el editor, no al pintar el HTML
 * guardado. Por eso la garantía vive en el punto de render, en el componente
 * `SanitizedHtml`, que es el único sitio del árbol que inyecta contenido de
 * usuario.
 *
 * La lista blanca es exactamente lo que las extensiones montadas en
 * `EditorContext` serializan, y nada más. `features/pages/editor-html.test.ts`
 * la contrasta contra el `getHTML()` de un editor real: si alguien monta una
 * extensión nueva y no abre su etiqueta aquí, ese test se cae antes de que el
 * capítulo se vea roto.
 */

/** Anchura de columna de las tablas redimensionables: `120px` o `50%`. */
const WIDTH = /^\d+(?:\.\d+)?(?:px|%)$/;

/**
 * Las únicas declaraciones de style que sobreviven, y sólo en la tabla: es como
 * Tiptap guarda el resultado de arrastrar el borde de una columna. Sin ellas la
 * tabla se recoloca sola al abrir el modo lectura.
 */
const TABLE_SIZING = { width: [WIDTH], "min-width": [WIDTH] };

/**
 * Una `data:` URL que de verdad es una imagen. El editor nunca las produce —el
 * nodo `image` sólo acepta http(s)— pero pegar desde Docs u Office sí puede
 * traerlas, y esas tienen que seguir viéndose.
 */
const DATA_IMAGE = /^data:image\/(png|jpeg|jpg|gif|webp|avif|bmp);/i;

const ALLOWED_TAGS = [
  // StarterKit
  "p", "h1", "h2", "h3", "ul", "ol", "li", "blockquote", "pre", "code",
  "strong", "em", "s", "a", "br", "hr",
  // Tablas
  "table", "thead", "tbody", "tfoot", "tr", "th", "td", "colgroup", "col",
  // Listas de tareas (TaskList / TaskItem)
  "label", "input", "span", "div",
  // Imágenes
  "img",
  // Nodos de medium: manga (section/article) y escaleta (div[data-scene-break])
  "section", "article",
] as const;

/**
 * `class` va en todas: el editor la usa para el estilo de las imágenes, de las
 * menciones del Codex y de los paneles de manga, y sin ella el capítulo deja de
 * verse igual. No es vector de ejecución.
 */
const ALLOWED_ATTRIBUTES: sanitizeHtml.IOptions["allowedAttributes"] = {
  "*": ["class"],
  a: ["href", "target", "rel"],
  img: ["src", "alt", "title", "width", "height"],
  table: ["style"],
  th: ["colspan", "rowspan", "colwidth", "style"],
  td: ["colspan", "rowspan", "colwidth", "style"],
  col: ["style"],
  // TaskItem serializa la casilla; `checked` la pinta marcada y `disabled` la
  // deja inerte, que es lo que corresponde en una vista de lectura.
  input: ["type", "checked", "disabled"],
  // Marca de nota adhesiva y mención del Codex.
  span: ["data-anchor-id", "data-mention", "data-entity-id", "data-entity-type", "data-label"],
  li: ["data-type", "data-checked"],
  ul: ["data-type"],
  // Guion, corte de escena, manga.
  p: ["data-sp"],
  div: ["data-scene-break", "data-arc", "data-leading"],
  section: ["data-manga-page"],
  article: ["data-panel"],
};

const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [...ALLOWED_TAGS],
  allowedAttributes: ALLOWED_ATTRIBUTES,
  // Fuera de la tabla no hay ningún style, y dentro sólo la anchura. Así no cabe
  // un `position: fixed` tapando la UI ni un `url()` filtrando la navegación.
  allowedStyles: {
    table: TABLE_SIZING,
    col: TABLE_SIZING,
    td: TABLE_SIZING,
    th: TABLE_SIZING,
  },
  // Un enlace que no sea uno de estos esquemas se queda sin `href`, y con eso
  // `javascript:` y `data:` dejan de ser clicables.
  allowedSchemes: ["http", "https", "mailto"],
  allowedSchemesByTag: { img: ["http", "https", "data"] },
  allowedSchemesAppliedToAttributes: ["href", "src"],
  transformTags: {
    // Un enlace a otro origen no debe poder tocar `window.opener`.
    a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer" }),
    // `allowedSchemes` sabe de esquemas, no de tipos: sin esto, `data:text/html`
    // pasaría por ser `data:`. No llega a ejecutarse desde un `src`, pero una
    // imagen que no es una imagen no tiene por qué quedarse.
    img: (tagName, attribs) => {
      const src = attribs.src;
      if (src?.toLowerCase().startsWith("data:") && !DATA_IMAGE.test(src)) {
        const withoutSrc = { ...attribs };
        delete withoutSrc.src;
        return { tagName, attribs: withoutSrc };
      }
      return { tagName, attribs };
    },
  },
  // El texto de un `<script>` filtrado no debe reaparecer como texto plano.
  nonTextTags: ["script", "style", "textarea", "option", "noscript"],
};

/**
 * Devuelve el HTML sin nada que pueda ejecutarse. Entrada vacía o nula devuelve
 * cadena vacía, que es lo que los dos puntos de render ya esperaban.
 */
export function sanitizePageHtml(html: string | null | undefined): string {
  if (!html) return "";
  return sanitizeHtml(html, OPTIONS);
}
