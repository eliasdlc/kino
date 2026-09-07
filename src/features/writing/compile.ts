import type { MediumId } from "@/shared/lib/mediums";
import { MEDIUM_CONFIG } from "@/shared/lib/mediums";

/**
 * Compilación del manuscrito completo (KIN-139): la obra entera (todos sus
 * capítulos en orden) en **un solo archivo** con portada, listo para mandárselo
 * a alguien.
 *
 * La decisión pendiente del ticket era dónde generar `docx` y `pdf`: una
 * librería de generación dentro del límite de 10s de Vercel puede no alcanzar
 * para una novela completa. La respuesta honesta resultó ser **no generarlos en
 * el servidor**:
 *
 * - `md`/`fountain` y `docx` se arman en el cliente. El navegador ya tiene el
 *   texto, ya trae `turndown` y un `.docx` es un zip de XML que se escribe con
 *   `jszip`, que ya es dependencia. Cero segundos de función, cero bundle nuevo.
 * - El PDF lo hace el propio navegador imprimiendo el modo lectura (KIN-138),
 *   que ya trae su hoja de estilos de impresión. Meter un motor de PDF para
 *   reproducir peor lo que el navegador hace bien no valía el costo.
 *
 * Todo lo de este módulo es puro: recibe el manuscrito y devuelve texto o las
 * piezas XML del `.docx`. Empaquetar y descargar es del llamador.
 */

export type CompileFormat = "markdown" | "docx";

export interface CompileMeta {
  title: string;
  author: string | null;
  medium: MediumId;
  totalWords: number;
  chapterCount: number;
  /** Fecha del borrador, en ISO corto. Se inyecta para poder probarla. */
  date: string;
}

export interface CompileChapter {
  title: string | null;
  /** Contenido ya serializado a texto por el llamador (turndown). */
  body: string;
}

/** Título legible de un capítulo, con su número como red de seguridad. */
export function chapterHeading(title: string | null, index: number, noun: string): string {
  const clean = title?.trim();
  if (clean) return clean;
  return `${noun.charAt(0).toUpperCase()}${noun.slice(1)} ${index}`;
}

/**
 * Portada en el formato que espera cada destino. Fountain tiene su propia página
 * de título (pares `Clave: valor` al principio) y la entienden Final Draft y
 * Highland; el resto lleva front matter YAML, que es lo que leen Pandoc, Obsidian
 * y compañía.
 */
export function frontMatter(meta: CompileMeta): string {
  const manifest = MEDIUM_CONFIG[meta.medium];

  if (manifest.exportFormat === "screenplay") {
    const lines = [`Title: ${meta.title}`];
    if (meta.author) {
      lines.push("Credit: Escrito por", `Author: ${meta.author}`);
    }
    lines.push(`Draft date: ${meta.date}`);
    return `${lines.join("\n")}\n`;
  }

  const yaml = [
    "---",
    `title: ${yamlValue(meta.title)}`,
    ...(meta.author ? [`author: ${yamlValue(meta.author)}`] : []),
    `date: ${meta.date}`,
    `medium: ${manifest.label}`,
    `words: ${meta.totalWords}`,
    "---",
  ];

  // Además del front matter, la portada visible: quien abra el archivo en un
  // lector cualquiera tiene que ver de qué obra se trata sin leer metadatos.
  const cover = [`# ${meta.title}`, ...(meta.author ? [`*${meta.author}*`] : [])];

  return `${yaml.join("\n")}\n\n${cover.join("\n\n")}\n`;
}

/** Escapa lo que rompería un escalar YAML sin comillas. */
function yamlValue(raw: string): string {
  const value = raw.trim();
  return /^[\w áéíóúüñÁÉÍÓÚÜÑ.,'()¡!¿?-]+$/.test(value)
    ? value
    : JSON.stringify(value);
}

/**
 * La obra entera en un archivo de texto. `toText` serializa el HTML de cada
 * capítulo: se inyecta para que este módulo no dependa del DOM ni de turndown y
 * se pueda probar con una función trivial.
 */
export function compileManuscript(
  meta: CompileMeta,
  chapters: CompileChapter[],
  toText: (html: string) => string,
): string {
  const manifest = MEDIUM_CONFIG[meta.medium];
  const noun = manifest.unit.noun;
  // Fountain marca sección con `#` y salto de página con `===`; el markdown usa
  // encabezado de nivel 2 bajo el título de la obra.
  const screenplay = manifest.exportFormat === "screenplay";

  const parts = [frontMatter(meta)];

  chapters.forEach((chapter, i) => {
    const heading = chapterHeading(chapter.title, i + 1, noun);
    const body = toText(chapter.body).trim();
    parts.push(
      screenplay
        ? `${i > 0 ? "===\n\n" : ""}# ${heading}\n\n${body}`
        : `## ${heading}\n\n${body}`,
    );
  });

  // Un capítulo vacío sigue siendo un capítulo: aparece con su título y nada
  // debajo, que es información: no se salta en silencio.
  return `${parts.join("\n\n")}\n`;
}

// ── .docx ────────────────────────────────────────────────────────────────────

export interface DocxRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
}

export type DocxBlock =
  | { kind: "title" | "author" | "heading" | "paragraph" | "quote"; runs: DocxRun[] }
  | { kind: "separator" }
  | { kind: "pageBreak" };

const XML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&apos;",
};

export function escapeXml(raw: string): string {
  return raw.replace(/[&<>"']/g, (ch) => XML_ESCAPES[ch]!);
}

function runXml(run: DocxRun): string {
  const props: string[] = [];
  if (run.bold) props.push("<w:b/>");
  if (run.italic) props.push("<w:i/>");
  const rPr = props.length ? `<w:rPr>${props.join("")}</w:rPr>` : "";
  // xml:space="preserve" o Word se come los espacios de los bordes del run.
  return `<w:r>${rPr}<w:t xml:space="preserve">${escapeXml(run.text)}</w:t></w:r>`;
}

const STYLE_BY_KIND: Record<string, string> = {
  title: "Title",
  author: "Subtitle",
  heading: "Heading1",
  paragraph: "Normal",
  quote: "Quote",
};

function blockXml(block: DocxBlock): string {
  if (block.kind === "pageBreak") {
    return '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
  }
  if (block.kind === "separator") {
    return '<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:t xml:space="preserve">* * *</w:t></w:r></w:p>';
  }
  const style = STYLE_BY_KIND[block.kind] ?? "Normal";
  const runs = block.runs.map(runXml).join("");
  return `<w:p><w:pPr><w:pStyle w:val="${style}"/></w:pPr>${runs}</w:p>`;
}

const DOCUMENT_NS =
  'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';

/** A4 con márgenes de 2,5 cm: lo que espera quien recibe un manuscrito. */
const SECTION =
  '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/>' +
  '<w:pgMar w:top="1418" w:right="1418" w:bottom="1418" w:left="1418" w:header="709" w:footer="709" w:gutter="0"/>' +
  "</w:sectPr>";

const XML_HEADER = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

const STYLES_XML = `${XML_HEADER}
<w:styles ${DOCUMENT_NS}>
<w:style w:type="paragraph" w:styleId="Normal" w:default="1"><w:name w:val="Normal"/><w:pPr><w:spacing w:after="0" w:line="360" w:lineRule="auto"/><w:ind w:firstLine="567"/><w:jc w:val="both"/></w:pPr><w:rPr><w:rFonts w:ascii="Georgia" w:hAnsi="Georgia"/><w:sz w:val="24"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:pPr><w:spacing w:before="2400" w:after="240"/><w:jc w:val="center"/></w:pPr><w:rPr><w:rFonts w:ascii="Georgia" w:hAnsi="Georgia"/><w:b/><w:sz w:val="56"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Subtitle"><w:name w:val="Subtitle"/><w:pPr><w:spacing w:after="240"/><w:jc w:val="center"/></w:pPr><w:rPr><w:rFonts w:ascii="Georgia" w:hAnsi="Georgia"/><w:i/><w:sz w:val="28"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:pPr><w:spacing w:before="480" w:after="360"/><w:jc w:val="center"/></w:pPr><w:rPr><w:rFonts w:ascii="Georgia" w:hAnsi="Georgia"/><w:b/><w:sz w:val="32"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Quote"><w:name w:val="Quote"/><w:pPr><w:spacing w:before="240" w:after="240"/><w:ind w:left="720" w:firstLine="0"/></w:pPr><w:rPr><w:rFonts w:ascii="Georgia" w:hAnsi="Georgia"/><w:i/><w:sz w:val="24"/></w:rPr></w:style>
</w:styles>`;

const CONTENT_TYPES = `${XML_HEADER}
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`;

const ROOT_RELS = `${XML_HEADER}
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

const DOCUMENT_RELS = `${XML_HEADER}
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

/**
 * Las piezas de un `.docx`, listas para meter en un zip. Un `.docx` es
 * exactamente eso: un zip con cuatro XML y un manifiesto de tipos. Escribirlo a
 * mano evita añadir una librería de ~500 kB para producir párrafos.
 */
export function buildDocxParts(blocks: DocxBlock[]): Record<string, string> {
  const body = blocks.map(blockXml).join("");
  return {
    "[Content_Types].xml": CONTENT_TYPES,
    "_rels/.rels": ROOT_RELS,
    "word/_rels/document.xml.rels": DOCUMENT_RELS,
    "word/styles.xml": STYLES_XML,
    "word/document.xml": `${XML_HEADER}\n<w:document ${DOCUMENT_NS}><w:body>${body}${SECTION}</w:body></w:document>`,
  };
}

/** Bloques de la portada del `.docx`. */
export function coverBlocks(meta: CompileMeta): DocxBlock[] {
  const blocks: DocxBlock[] = [{ kind: "title", runs: [{ text: meta.title }] }];
  if (meta.author) blocks.push({ kind: "author", runs: [{ text: meta.author }] });
  blocks.push({
    kind: "author",
    runs: [{ text: `${meta.totalWords.toLocaleString("es")} palabras · ${meta.date}` }],
  });
  return blocks;
}
