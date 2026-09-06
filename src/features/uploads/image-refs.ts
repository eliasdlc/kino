/**
 * Referencias a imágenes dentro del contenido del usuario.
 *
 * Las imágenes se suben desde exactamente dos sitios (el editor de páginas y las
 * fichas del Codex), pero se *referencian* desde el HTML guardado en `pages.content`
 * y desde las columnas de `entities`. Este módulo es el único que sabe leer esas
 * referencias, y lo usan tanto el export del workspace (empaquetar lo referenciado)
 * como el barrido de huérfanas (borrar lo que no lo está). Que ambos lean con el
 * mismo código es lo que evita que el barrido borre algo que el export sí veía.
 */

// El espacio antes de `src` no es cosmético: sin él, `\bsrc` casaría también con
// `data-src` y se recogería una URL que el navegador nunca pinta.
const IMG_SRC = /<img\b[^>]*?\ssrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s">]+))/gi;

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&lt;": "<",
  "&gt;": ">",
};

function decodeEntities(value: string): string {
  return value.replace(/&(?:amp|quot|#39|apos|lt|gt);/g, (match) => ENTITIES[match] ?? match);
}

/**
 * URLs de los `<img>` de un fragmento de HTML, en orden de aparición y sin repetir.
 *
 * Se usa una expresión regular y no un parser de DOM a propósito: este código corre
 * en rutas de API donde no hay `document`, y el HTML que llega siempre lo generó
 * Tiptap, que serializa atributos entrecomillados y bien formados.
 */
export function extractImageUrlsFromHtml(html: string | null | undefined): string[] {
  if (!html) return [];
  const found = new Set<string>();
  for (const match of html.matchAll(IMG_SRC)) {
    const raw = match[1] ?? match[2] ?? match[3] ?? "";
    const url = decodeEntities(raw).trim();
    if (url) found.add(url);
  }
  return [...found];
}

/**
 * Reescribe los `src` del HTML según el mapa dado. Lo que no aparezca en el mapa se
 * queda intacto: así una imagen que no se pudo empaquetar conserva su URL remota en
 * vez de romperse.
 */
export function rewriteImageUrls(html: string, replacements: Map<string, string>): string {
  if (replacements.size === 0) return html;
  return html.replace(IMG_SRC, (match, dquote?: string, squote?: string, bare?: string) => {
    const raw = dquote ?? squote ?? bare ?? "";
    const next = replacements.get(decodeEntities(raw).trim());
    if (next === undefined) return match;
    // El match va desde `<img` hasta el cierre del valor de src. Se reconstruye
    // conservando el prefijo tal cual y el mismo estilo de comillas.
    const quote = dquote !== undefined ? '"' : squote !== undefined ? "'" : "";
    const prefix = match.slice(0, match.length - raw.length - quote.length * 2);
    return `${prefix}${quote}${next.replace(/&/g, "&amp;").replace(/"/g, "&quot;")}${quote}`;
  });
}

const SAFE_NAME = /[^a-zA-Z0-9._-]/g;

/**
 * Nombre de archivo para empaquetar una URL. Las subidas propias ya terminan en
 * `<uuid>.<ext>`, que es único por construcción; cualquier otra cosa se sanea y el
 * llamador resuelve colisiones.
 */
export function assetFileName(url: string): string {
  let base = "";
  try {
    base = new URL(url).pathname.split("/").pop() ?? "";
  } catch {
    base = url.split("/").pop() ?? "";
  }
  // Se decodifica antes de sanear para que un `%20` no acabe convertido en guiones
  // sueltos. El saneo va después, así que un `%2f` decodificado tampoco escapa.
  try {
    base = decodeURIComponent(base);
  } catch {
    // Secuencia porcentual inválida: se sanea el crudo.
  }
  const safe = base.replace(SAFE_NAME, "-").replace(/^-+/, "");
  return safe || "imagen";
}
