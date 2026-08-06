import { describe, expect, it } from "vitest";
import { exportFileMeta, htmlToMarkdown } from "./html-to-markdown";
import { rewriteImageUrls } from "@/features/uploads/image-refs";

describe("htmlToMarkdown — prosa", () => {
  it("mantiene el comportamiento base del editor", () => {
    const md = htmlToMarkdown(
      '<h1>Capítulo 1</h1><p>Kael cruzó el <strong>puente</strong>.</p>' +
        '<ul data-type="taskList"><li data-checked="true"><p>revisar</p></li></ul>',
    );
    expect(md).toContain("# Capítulo 1");
    expect(md).toContain("**puente**");
    expect(md).toContain("- [x] revisar");
  });

  it("el separador de escena viaja como `* * *`", () => {
    const md = htmlToMarkdown(
      '<p>antes</p><div data-scene-break>* * *</div><p>después</p>',
      { medium: "novel" },
    );
    expect(md).toBe("antes\n\n* * *\n\ndespués");
  });

  it("conserva el texto de las menciones del codex", () => {
    const md = htmlToMarkdown(
      '<p>Habló con <span data-mention data-entity-id="e1" class="codex-mention">@Kael</span>.</p>',
    );
    expect(md).toBe("Habló con @Kael.");
  });
});

describe("htmlToMarkdown — guion de manga", () => {
  const html =
    "<section data-manga-page>" +
    "<article data-panel><p>Kael entra al dojo.</p></article>" +
    "<article data-panel><p>KAEL: Llegué.</p></article>" +
    "</section>" +
    "<section data-manga-page><article data-panel><p>Cierre a negro.</p></article></section>";

  it("numera páginas y paneles por posición", () => {
    const md = htmlToMarkdown(html, { medium: "manga" });
    expect(md).toContain("## Página 1");
    expect(md).toContain("## Página 2");
    expect(md).toContain("**Panel 1**");
    expect(md).toContain("**Panel 2**");
  });

  it("los paneles de cada página vuelven a empezar en 1", () => {
    const md = htmlToMarkdown(html, { medium: "manga" });
    const segunda = md.slice(md.indexOf("## Página 2"));
    expect(segunda).toContain("**Panel 1**");
    expect(segunda).not.toContain("**Panel 2**");
  });
});

describe("htmlToMarkdown — guion audiovisual (Fountain)", () => {
  const html =
    '<p data-sp="sceneHeading">int. casa de kael - noche</p>' +
    '<p data-sp="action">Kael cierra la puerta.</p>' +
    '<p data-sp="character">kael</p>' +
    '<p data-sp="parenthetical">en voz baja</p>' +
    '<p data-sp="dialogue">No deberías estar aquí.</p>';

  it("escribe el encabezado en mayúsculas y el personaje pegado a su diálogo", () => {
    const out = htmlToMarkdown(html, { medium: "screenplay" });
    expect(out).toBe(
      [
        "INT. CASA DE KAEL - NOCHE",
        "",
        "Kael cierra la puerta.",
        "",
        "KAEL",
        "(en voz baja)",
        "No deberías estar aquí.",
      ].join("\n"),
    );
  });

  it("fuerza con `.` el encabezado que no empieza por INT./EXT.", () => {
    const out = htmlToMarkdown('<p data-sp="sceneHeading">flashback</p>', {
      medium: "screenplay",
    });
    expect(out).toBe(".FLASHBACK");
  });

  it("el paréntesis ya escrito con paréntesis no se duplica", () => {
    const out = htmlToMarkdown(
      '<p data-sp="character">kael</p><p data-sp="parenthetical">(riendo)</p>' +
        '<p data-sp="dialogue">Ya.</p>',
      { medium: "screenplay" },
    );
    expect(out).toBe("KAEL\n(riendo)\nYa.");
  });

  it("sin medium, el mismo guion sale como Markdown legible en vez de Fountain", () => {
    const md = htmlToMarkdown(html);
    expect(md).toContain("### INT. CASA DE KAEL - NOCHE");
    expect(md).toContain("**KAEL**");
    expect(md).toContain("_(en voz baja)_");
  });
});

// Lo que hace el export del workspace: reescribir los `src` a la copia local y
// entonces serializar. Es la composición que decide si el ZIP abre con imágenes.
describe("htmlToMarkdown — imágenes empaquetadas", () => {
  const BLOB = "https://abc.public.blob.vercel-storage.com/u/user-1/foto.webp";

  it("emite la ruta relativa al assets del ZIP", () => {
    const html = `<p>antes</p><img src="${BLOB}" alt="La torre"><p>después</p>`;
    const md = htmlToMarkdown(rewriteImageUrls(html, new Map([[BLOB, "../../assets/foto.webp"]])));

    expect(md).toContain("![La torre](../../assets/foto.webp)");
    expect(md).not.toContain("blob.vercel-storage.com");
  });

  it("deja intacta la imagen que no se pudo empaquetar", () => {
    const externa = "https://ajena.example/foto.png";
    const md = htmlToMarkdown(rewriteImageUrls(`<img src="${externa}">`, new Map()));

    expect(md).toContain(externa);
  });
});

describe("exportFileMeta", () => {
  it("solo el guion cambia de extensión", () => {
    expect(exportFileMeta("screenplay")).toEqual({
      extension: "fountain",
      label: "Fountain (.fountain)",
    });
    expect(exportFileMeta("novel").extension).toBe("md");
    expect(exportFileMeta(null).extension).toBe("md");
  });
});
