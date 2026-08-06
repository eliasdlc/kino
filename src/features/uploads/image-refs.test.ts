import { describe, it, expect } from "vitest";
import { extractImageUrlsFromHtml, rewriteImageUrls, assetFileName } from "./image-refs";

const BLOB = "https://abc123.public.blob.vercel-storage.com/u/user-1/aaaa-bbbb.webp";

describe("extractImageUrlsFromHtml", () => {
  it("devuelve [] para contenido vacío o nulo", () => {
    expect(extractImageUrlsFromHtml(null)).toEqual([]);
    expect(extractImageUrlsFromHtml(undefined)).toEqual([]);
    expect(extractImageUrlsFromHtml("")).toEqual([]);
    expect(extractImageUrlsFromHtml("<p>sin imágenes</p>")).toEqual([]);
  });

  it("extrae el src de un img de Tiptap", () => {
    const html = `<p>hola</p><img src="${BLOB}" alt="foto">`;
    expect(extractImageUrlsFromHtml(html)).toEqual([BLOB]);
  });

  it("no depende del orden de los atributos", () => {
    const html = `<img alt="foto" width="300" src="${BLOB}" class="x">`;
    expect(extractImageUrlsFromHtml(html)).toEqual([BLOB]);
  });

  it("acepta comillas simples y valores sin comillas", () => {
    expect(extractImageUrlsFromHtml(`<img src='${BLOB}'>`)).toEqual([BLOB]);
    expect(extractImageUrlsFromHtml(`<img src=${BLOB}>`)).toEqual([BLOB]);
  });

  it("decodifica entidades en la URL", () => {
    const html = `<img src="https://x.com/a?w=1&amp;h=2">`;
    expect(extractImageUrlsFromHtml(html)).toEqual(["https://x.com/a?w=1&h=2"]);
  });

  it("deduplica la misma imagen usada varias veces", () => {
    const html = `<img src="${BLOB}"><p>x</p><img src="${BLOB}">`;
    expect(extractImageUrlsFromHtml(html)).toEqual([BLOB]);
  });

  it("recoge varias imágenes en orden de aparición", () => {
    const other = "https://abc123.public.blob.vercel-storage.com/u/user-1/cccc.png";
    const html = `<img src="${BLOB}"><img src="${other}">`;
    expect(extractImageUrlsFromHtml(html)).toEqual([BLOB, other]);
  });

  it("ignora atributos que solo terminan en src", () => {
    const html = `<img data-src="https://no.example/x.png" src="${BLOB}">`;
    expect(extractImageUrlsFromHtml(html)).toEqual([BLOB]);
  });

  it("no confunde otras etiquetas con img", () => {
    const html = `<video src="https://no.example/v.mp4"></video><iframe src="https://no.example"></iframe>`;
    expect(extractImageUrlsFromHtml(html)).toEqual([]);
  });
});

describe("rewriteImageUrls", () => {
  it("devuelve el html intacto si no hay reemplazos", () => {
    const html = `<img src="${BLOB}">`;
    expect(rewriteImageUrls(html, new Map())).toBe(html);
  });

  it("sustituye solo las URLs presentes en el mapa", () => {
    const externa = "https://ajena.example/foto.png";
    const html = `<img src="${BLOB}"><img src="${externa}">`;
    const out = rewriteImageUrls(html, new Map([[BLOB, "../../assets/aaaa-bbbb.webp"]]));
    expect(out).toBe(`<img src="../../assets/aaaa-bbbb.webp"><img src="${externa}">`);
  });

  it("conserva el resto de atributos y el estilo de comillas", () => {
    const html = `<img alt="foto" src='${BLOB}' width="300">`;
    const out = rewriteImageUrls(html, new Map([[BLOB, "../../assets/x.webp"]]));
    expect(out).toBe(`<img alt="foto" src='../../assets/x.webp' width="300">`);
  });

  it("reescribe todas las apariciones de la misma imagen", () => {
    const html = `<img src="${BLOB}"><p>x</p><img src="${BLOB}">`;
    const out = rewriteImageUrls(html, new Map([[BLOB, "../../assets/x.webp"]]));
    expect(out).toBe(`<img src="../../assets/x.webp"><p>x</p><img src="../../assets/x.webp">`);
  });

  it("casa por la URL decodificada, no por el texto crudo", () => {
    const html = `<img src="https://x.com/a?w=1&amp;h=2">`;
    const out = rewriteImageUrls(html, new Map([["https://x.com/a?w=1&h=2", "assets/a.png"]]));
    expect(out).toBe(`<img src="assets/a.png">`);
  });

  it("escapa el reemplazo para que no rompa el atributo", () => {
    const html = `<img src="${BLOB}">`;
    const out = rewriteImageUrls(html, new Map([[BLOB, 'a"b&c.png']]));
    expect(out).toBe(`<img src="a&quot;b&amp;c.png">`);
  });
});

describe("assetFileName", () => {
  it("usa el último segmento de la ruta", () => {
    expect(assetFileName(BLOB)).toBe("aaaa-bbbb.webp");
  });

  it("descarta la query string", () => {
    expect(assetFileName("https://x.com/a/foto.png?w=100")).toBe("foto.png");
  });

  it("sanea caracteres raros", () => {
    expect(assetFileName("https://x.com/a/mi foto (1).png")).toBe("mi-foto--1-.png");
  });

  it("no permite escapar del directorio", () => {
    expect(assetFileName("https://x.com/a/..%2f..%2fetc")).not.toContain("/");
    expect(assetFileName("no-es-una-url")).toBe("no-es-una-url");
  });

  it("cae a un nombre por defecto cuando no queda nada", () => {
    expect(assetFileName("https://x.com/")).toBe("imagen");
  });
});
