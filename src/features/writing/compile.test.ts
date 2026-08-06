import { describe, expect, it } from "vitest";
import {
  buildDocxParts,
  chapterHeading,
  compileManuscript,
  coverBlocks,
  escapeXml,
  frontMatter,
  type CompileMeta,
} from "./compile";
import { htmlToDocxBlocks } from "./html-to-docx";

const META: CompileMeta = {
  title: "La marea baja",
  author: "Elias De La Cruz",
  medium: "novel",
  totalWords: 24310,
  chapterCount: 2,
  date: "2026-08-06",
};

/** Serializador trivial: lo real es turndown, que ya tiene sus propios tests. */
const plain = (html: string) => html.replace(/<[^>]+>/g, "").trim();

describe("frontMatter", () => {
  it("la prosa lleva YAML y una portada visible", () => {
    const out = frontMatter(META);
    expect(out).toContain("---\ntitle: La marea baja");
    expect(out).toContain("author: Elias De La Cruz");
    expect(out).toContain("words: 24310");
    // Quien abra el archivo en un lector cualquiera tiene que ver la portada.
    expect(out).toContain("# La marea baja");
    expect(out).toContain("*Elias De La Cruz*");
  });

  it("el guion lleva la página de título de Fountain, no YAML", () => {
    const out = frontMatter({ ...META, medium: "screenplay" });
    expect(out).toContain("Title: La marea baja");
    expect(out).toContain("Credit: Escrito por");
    expect(out).toContain("Author: Elias De La Cruz");
    expect(out).not.toContain("---");
  });

  it("sin autor no inventa la línea", () => {
    const out = frontMatter({ ...META, author: null });
    expect(out).not.toContain("author:");
    expect(out).toContain("# La marea baja");
  });

  it("entrecomilla un título que rompería el YAML", () => {
    const out = frontMatter({ ...META, title: "Tomo 2: el regreso" });
    expect(out).toContain('title: "Tomo 2: el regreso"');
  });

  it("deja sin comillas un título con acentos y signos del español", () => {
    const out = frontMatter({ ...META, title: "¿Quién cerró la puerta?" });
    expect(out).toContain("title: ¿Quién cerró la puerta?");
  });
});

describe("chapterHeading", () => {
  it("usa el título del capítulo cuando lo tiene", () => {
    expect(chapterHeading("La niebla", 3, "capítulo")).toBe("La niebla");
  });

  it("cae al sustantivo del medium con su número", () => {
    expect(chapterHeading(null, 3, "capítulo")).toBe("Capítulo 3");
    expect(chapterHeading("   ", 2, "episodio")).toBe("Episodio 2");
  });
});

describe("compileManuscript", () => {
  const chapters = [
    { title: "La niebla", body: "<p>Uno</p>" },
    { title: null, body: "<p>Dos</p>" },
  ];

  it("junta los capítulos en orden bajo la portada", () => {
    const out = compileManuscript(META, chapters, plain);
    expect(out.indexOf("# La marea baja")).toBeLessThan(out.indexOf("## La niebla"));
    expect(out.indexOf("## La niebla")).toBeLessThan(out.indexOf("## Capítulo 2"));
    expect(out).toContain("Uno");
    expect(out).toContain("Dos");
  });

  it("un capítulo vacío aparece con su título: no se salta en silencio", () => {
    const out = compileManuscript(META, [{ title: "En blanco", body: "" }], plain);
    expect(out).toContain("## En blanco");
  });

  it("el guion separa escenas con el salto de página de Fountain", () => {
    const out = compileManuscript({ ...META, medium: "screenplay" }, chapters, plain);
    expect(out).toContain("# La niebla");
    expect(out).toContain("===");
    // El salto va entre escenas, nunca antes de la primera.
    expect(out.indexOf("===")).toBeGreaterThan(out.indexOf("# La niebla"));
  });

  it("una obra sin capítulos sigue produciendo un archivo con portada", () => {
    const out = compileManuscript(META, [], plain);
    expect(out).toContain("# La marea baja");
  });
});

describe("escapeXml", () => {
  it("escapa lo que rompería el XML del docx", () => {
    expect(escapeXml('a & b < c > d "e" \'f\'')).toBe(
      "a &amp; b &lt; c &gt; d &quot;e&quot; &apos;f&apos;",
    );
  });
});

describe("buildDocxParts", () => {
  it("produce las cinco piezas que exige el formato", () => {
    const parts = buildDocxParts(coverBlocks(META));
    expect(Object.keys(parts).sort()).toEqual([
      "[Content_Types].xml",
      "_rels/.rels",
      "word/_rels/document.xml.rels",
      "word/document.xml",
      "word/styles.xml",
    ]);
  });

  it("el documento declara el namespace y cierra la sección", () => {
    const { "word/document.xml": doc } = buildDocxParts([
      { kind: "paragraph", runs: [{ text: "Hola" }] },
    ]);
    expect(doc).toContain("wordprocessingml/2006/main");
    expect(doc).toContain("<w:sectPr>");
    expect(doc).toContain("<w:t xml:space=\"preserve\">Hola</w:t>");
  });

  it("el texto del manuscrito va escapado dentro del XML", () => {
    const { "word/document.xml": doc } = buildDocxParts([
      { kind: "paragraph", runs: [{ text: "Bruno & <Aurelia>" }] },
    ]);
    expect(doc).toContain("Bruno &amp; &lt;Aurelia&gt;");
    expect(doc).not.toContain("<Aurelia>");
  });

  it("negrita y cursiva se traducen a propiedades de run", () => {
    const { "word/document.xml": doc } = buildDocxParts([
      { kind: "paragraph", runs: [{ text: "x", bold: true, italic: true }] },
    ]);
    expect(doc).toContain("<w:b/>");
    expect(doc).toContain("<w:i/>");
  });

  it("el salto de página y el separador de escena tienen su propio párrafo", () => {
    const { "word/document.xml": doc } = buildDocxParts([
      { kind: "pageBreak" },
      { kind: "separator" },
    ]);
    expect(doc).toContain('<w:br w:type="page"/>');
    expect(doc).toContain("* * *");
  });
});

describe("htmlToDocxBlocks", () => {
  const parse = (html: string) =>
    new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");

  it("un párrafo con énfasis llega a Word con el énfasis, no con asteriscos", () => {
    const [block] = htmlToDocxBlocks("<p>Le dijo <strong>que no</strong>.</p>", parse);
    expect(block).toEqual({
      kind: "paragraph",
      runs: [
        { text: "Le dijo ", bold: false, italic: false },
        { text: "que no", bold: true, italic: false },
        { text: ".", bold: false, italic: false },
      ],
    });
  });

  it("fusiona runs contiguos del mismo estilo", () => {
    const [block] = htmlToDocxBlocks("<p>uno <span>dos</span> tres</p>", parse);
    expect(block).toMatchObject({ runs: [{ text: "uno dos tres" }] });
  });

  it("los encabezados y las citas conservan su papel", () => {
    const blocks = htmlToDocxBlocks("<h2>Parte I</h2><blockquote>Cita</blockquote>", parse);
    expect(blocks.map((b) => b.kind)).toEqual(["heading", "quote"]);
  });

  it("el separador de escena se reconoce por su atributo", () => {
    const blocks = htmlToDocxBlocks('<div data-scene-break></div>', parse);
    expect(blocks).toEqual([{ kind: "separator" }]);
  });

  it("las listas se aplanan con su marcador", () => {
    const blocks = htmlToDocxBlocks("<ol><li>uno</li><li>dos</li></ol>", parse);
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toMatchObject({ runs: [{ text: "1. " }, { text: "uno" }] });
  });

  it("las páginas y paneles del guion de manga se etiquetan y se recorren", () => {
    const blocks = htmlToDocxBlocks(
      "<section data-manga-page><article data-panel><p>Aurelia mira.</p></article></section>",
      parse,
    );
    expect(blocks.map((b) => b.kind)).toEqual(["heading", "heading", "paragraph"]);
  });

  it("descarta los párrafos en blanco que deja el editor", () => {
    expect(htmlToDocxBlocks("<p></p><p>  </p>", parse)).toEqual([]);
  });

  it("un capítulo vacío no produce bloques", () => {
    expect(htmlToDocxBlocks("", parse)).toEqual([]);
    expect(htmlToDocxBlocks("   ", parse)).toEqual([]);
  });

  it("una etiqueta no contemplada conserva su texto: en un export nada se pierde", () => {
    const [block] = htmlToDocxBlocks("<figure>Pie de imagen</figure>", parse);
    expect(block).toMatchObject({ kind: "paragraph", runs: [{ text: "Pie de imagen" }] });
  });
});
