import type { DocxBlock, DocxRun } from "./compile";

/**
 * HTML de Tiptap → bloques de `.docx` (KIN-139).
 *
 * Se recorre el DOM en vez de reaprovechar el Markdown de turndown a propósito:
 * pasando por Markdown, un `**énfasis**` llegaría a Word como asteriscos
 * literales. Recorriendo los nodos, la negrita sale negrita.
 *
 * Solo se traduce lo que un manuscrito usa de verdad. Lo que no está contemplado
 * cae a párrafo con su texto: en un export nunca se pierde contenido, como mucho
 * pierde formato.
 */

const BOLD_TAGS = new Set(["B", "STRONG"]);
const ITALIC_TAGS = new Set(["I", "EM"]);
const HEADING_TAGS = new Set(["H1", "H2", "H3", "H4", "H5", "H6"]);

interface RunStyle {
  bold?: boolean;
  italic?: boolean;
}

/** Aplana un elemento a runs, arrastrando negrita y cursiva de los padres. */
function collectRuns(node: Node, style: RunStyle, out: DocxRun[]): void {
  if (node.nodeType === 3) {
    const text = node.textContent ?? "";
    if (!text) return;
    const last = out[out.length - 1];
    // Fusionar runs contiguos con el mismo estilo: Word no gana nada con
    // cincuenta runs de una palabra y el XML pesa el triple.
    if (last && !!last.bold === !!style.bold && !!last.italic === !!style.italic) {
      last.text += text;
      return;
    }
    out.push({ text, ...style });
    return;
  }

  if (node.nodeType !== 1) return;
  const el = node as Element;
  const next: RunStyle = {
    bold: style.bold || BOLD_TAGS.has(el.tagName),
    italic: style.italic || ITALIC_TAGS.has(el.tagName),
  };
  for (const child of Array.from(el.childNodes)) collectRuns(child, next, out);
}

function runsOf(el: Element): DocxRun[] {
  const runs: DocxRun[] = [];
  collectRuns(el, {}, runs);
  // Normalizar el espacio: el HTML del editor trae saltos de línea de indentado
  // que en Word aparecerían como espacios sueltos al principio del párrafo.
  return runs
    .map((r) => ({ ...r, text: r.text.replace(/\s+/g, " ") }))
    .filter((r) => r.text.length > 0);
}

function isBlank(runs: DocxRun[]): boolean {
  return runs.every((r) => r.text.trim().length === 0);
}

function blockFor(el: Element): DocxBlock[] {
  if (el.hasAttribute("data-scene-break")) return [{ kind: "separator" }];

  if (HEADING_TAGS.has(el.tagName)) {
    const runs = runsOf(el);
    return isBlank(runs) ? [] : [{ kind: "heading", runs }];
  }

  if (el.tagName === "BLOCKQUOTE") {
    const runs = runsOf(el);
    return isBlank(runs) ? [] : [{ kind: "quote", runs }];
  }

  if (el.tagName === "UL" || el.tagName === "OL") {
    const items = Array.from(el.children).filter((c) => c.tagName === "LI");
    return items.flatMap((li, i) => {
      const runs = runsOf(li);
      if (isBlank(runs)) return [];
      const marker = el.tagName === "OL" ? `${i + 1}. ` : "· ";
      return [{ kind: "paragraph" as const, runs: [{ text: marker }, ...runs] }];
    });
  }

  // Contenedores estructurales del guion de manga (página, panel): sus hijos son
  // los párrafos de verdad, así que se recorren en vez de aplanarse.
  if (el.hasAttribute("data-manga-page") || el.hasAttribute("data-panel")) {
    const label = el.hasAttribute("data-manga-page") ? "Página" : "Panel";
    const inner = Array.from(el.children).flatMap(blockFor);
    return [{ kind: "heading", runs: [{ text: label }] }, ...inner];
  }

  const runs = runsOf(el);
  return isBlank(runs) ? [] : [{ kind: "paragraph", runs }];
}

/**
 * Convierte el HTML de un capítulo. Recibe el `Document` para no depender de un
 * global: en el cliente es `new DOMParser()`, y en los tests, jsdom.
 */
export function htmlToDocxBlocks(html: string, parse: (html: string) => Document): DocxBlock[] {
  const trimmed = html?.trim();
  if (!trimmed) return [];
  const doc = parse(trimmed);
  return Array.from(doc.body.children).flatMap(blockFor);
}

/** El parser del navegador, listo para pasar a `htmlToDocxBlocks`. */
export function domParse(html: string): Document {
  return new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
}
