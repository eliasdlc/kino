import TurndownService from "turndown";
import { MEDIUM_CONFIG, type MediumId } from "@/shared/lib/mediums";

/**
 * Serialización del manuscrito por medium (PLAN-11 §6). Un mismo editor produce
 * tres salidas: prosa en Markdown, guion de manga/cómic numerado por página y
 * panel, y guion audiovisual en **Fountain** — el formato de texto plano que
 * importan Final Draft, Highland y compañía.
 *
 * La numeración de páginas y paneles se recalcula por posición en el DOM, igual
 * que en el editor: no hay número guardado que pueda quedar desfasado.
 */

type TurndownNode = Parameters<NonNullable<TurndownService.Rule["replacement"]>>[1];

function element(node: TurndownNode): Element | null {
  return node && typeof (node as Element).hasAttribute === "function"
    ? (node as Element)
    : null;
}

function hasAttr(node: TurndownNode, attr: string): boolean {
  return element(node)?.hasAttribute(attr) ?? false;
}

function isScreenplay(node: TurndownNode, kind: string): boolean {
  return element(node)?.getAttribute("data-sp") === kind;
}

function isLeadingBreak(node: TurndownNode): boolean {
  return element(node)?.getAttribute("data-leading") === "true";
}

/** Posición 1-based del nodo entre los hermanos que cumplen el mismo predicado. */
function siblingIndex(node: TurndownNode, matches: (el: Element) => boolean): number {
  const parent = (node as Element).parentNode;
  if (!parent) return 1;
  let seen = 0;
  for (const child of Array.from(parent.childNodes)) {
    const el = child as Element;
    if (el.nodeType === 1 && matches(el)) {
      seen += 1;
      if (el === node) return seen;
    }
  }
  return Math.max(1, seen);
}

const isPageEl = (el: Element) => el.hasAttribute("data-manga-page");
const isPanelEl = (el: Element) => el.hasAttribute("data-panel");

function parenthesize(text: string): string {
  return text.startsWith("(") && text.endsWith(")") ? text : `(${text})`;
}

function baseService(): TurndownService {
  const td = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    bulletListMarker: "-",
  });

  // Strip sticky-anchor <span data-anchor-id="…"> — keep the inner text
  td.addRule("stickyAnchor", {
    filter: (node) => node.nodeName === "SPAN" && node.hasAttribute("data-anchor-id"),
    replacement: (content) => content,
  });

  // Tiptap task lists render as <ul data-type="taskList"><li data-checked="…">
  td.addRule("taskList", {
    filter: (node) => node.nodeName === "LI" && node.hasAttribute("data-checked"),
    replacement: (content, node) => {
      const checked = (node as HTMLElement).getAttribute("data-checked") === "true";
      return `- [${checked ? "x" : " "}] ${content.trim()}\n`;
    },
  });

  return td;
}

/** Markdown: prosa y guion de manga/cómic. Sirve también de fallback genérico. */
function markdownService(): TurndownService {
  const td = baseService();

  td.addRule("sceneBreak", {
    filter: (node) => hasAttr(node, "data-scene-break"),
    // El corte guía del plot grid (KIN-141) solo carga el arco de la primera
    // escena: no es un separador y no debe aparecer en el archivo exportado.
    replacement: (_content, node) => (isLeadingBreak(node) ? "" : "\n\n* * *\n\n"),
  });

  td.addRule("mangaPage", {
    filter: (node) => hasAttr(node, "data-manga-page"),
    replacement: (content, node) =>
      `\n\n## Página ${siblingIndex(node, isPageEl)}\n\n${content.trim()}\n\n`,
  });

  td.addRule("panel", {
    filter: (node) => hasAttr(node, "data-panel"),
    replacement: (content, node) =>
      `\n\n**Panel ${siblingIndex(node, isPanelEl)}**\n\n${content.trim()}\n\n`,
  });

  // Un guion exportado a Markdown (p.ej. el export del workspace, que recorre
  // todas las pages sin conocer el medium de cada obra) conserva el papel de
  // cada línea en vez de aplanarse a párrafos indistinguibles.
  td.addRule("screenplayBlocks", {
    filter: (node) => hasAttr(node, "data-sp"),
    replacement: (content, node) => {
      const text = content.trim();
      if (!text) return "\n\n";
      if (isScreenplay(node, "sceneHeading")) return `\n\n### ${text.toUpperCase()}\n\n`;
      if (isScreenplay(node, "character")) return `\n\n**${text.toUpperCase()}**\n\n`;
      if (isScreenplay(node, "parenthetical")) return `\n\n_${parenthesize(text)}_\n\n`;
      return `\n\n${text}\n\n`;
    },
  });

  return td;
}

const SLUGLINE_PREFIX = /^(INT|EXT|EST|I\/E)[.\s]/i;

/** Fountain exige que el encabezado empiece por INT./EXT.; si no, se fuerza con ".". */
function slugline(text: string): string {
  const upper = text.toUpperCase();
  return SLUGLINE_PREFIX.test(upper) ? upper : `.${upper}`;
}

/**
 * Fountain. Las separaciones importan: personaje y diálogo van pegados por un
 * único salto de línea, y todo lo demás separado por una línea en blanco. Turndown
 * une dos bloques con el máximo de saltos entre el final de uno y el principio del
 * siguiente, así que cada regla declara su propio espaciado.
 */
function fountainService(): TurndownService {
  const td = baseService();

  td.addRule("sceneBreak", {
    filter: (node) => hasAttr(node, "data-scene-break"),
    replacement: (_content, node) => (isLeadingBreak(node) ? "" : "\n\n> * * * <\n\n"),
  });

  td.addRule("screenplay", {
    filter: (node) => hasAttr(node, "data-sp"),
    replacement: (content, node) => {
      const text = content.trim();
      if (!text) return "\n\n";
      if (isScreenplay(node, "sceneHeading")) return `\n\n${slugline(text)}\n\n`;
      // Personaje y paréntesis abren bloque de diálogo: un solo salto detrás.
      if (isScreenplay(node, "character")) return `\n\n${text.toUpperCase()}\n`;
      if (isScreenplay(node, "parenthetical")) return `${parenthesize(text)}\n`;
      if (isScreenplay(node, "dialogue")) return `${text}\n\n`;
      return `\n\n${text}\n\n`;
    },
  });

  // Un guion no debería llevar páginas de manga, pero si las lleva se conservan
  // como secciones en lugar de perderse.
  td.addRule("mangaPage", {
    filter: (node) => hasAttr(node, "data-manga-page"),
    replacement: (content, node) =>
      `\n\n# Página ${siblingIndex(node, isPageEl)}\n\n${content.trim()}\n\n`,
  });

  td.addRule("panel", {
    filter: (node) => hasAttr(node, "data-panel"),
    replacement: (content, node) =>
      `\n\n## Panel ${siblingIndex(node, isPanelEl)}\n\n${content.trim()}\n\n`,
  });

  return td;
}

let markdown: TurndownService | null = null;
let fountain: TurndownService | null = null;

function serviceFor(medium?: MediumId | null): TurndownService {
  const format = medium ? MEDIUM_CONFIG[medium].exportFormat : "prose";
  if (format === "screenplay") {
    fountain ??= fountainService();
    return fountain;
  }
  markdown ??= markdownService();
  return markdown;
}

export function htmlToMarkdown(
  html: string,
  options?: { medium?: MediumId | null },
): string {
  return serviceFor(options?.medium).turndown(html);
}

/** Extensión y etiqueta del archivo que produce `htmlToMarkdown` para un medium. */
export function exportFileMeta(medium?: MediumId | null): {
  extension: string;
  label: string;
} {
  const manifest = medium ? MEDIUM_CONFIG[medium] : null;
  return manifest?.exportExtension === "fountain"
    ? { extension: "fountain", label: "Fountain (.fountain)" }
    : { extension: "md", label: "Markdown (.md)" };
}
