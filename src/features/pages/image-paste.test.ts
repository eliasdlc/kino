import { describe, expect, it } from "vitest";
import { isImageUrl } from "./image-paste.extension";

describe("isImageUrl", () => {
  it("acepta URLs de imagen con extensión conocida", () => {
    expect(isImageUrl("https://ejemplo.com/foto.png")).toBe(true);
    expect(isImageUrl("http://cdn.site.io/a/b/c.JPEG")).toBe(true);
    expect(isImageUrl("https://x.com/img.webp?width=800")).toBe(true);
  });

  it("rechaza lo que no es una URL de imagen pelada", () => {
    expect(isImageUrl("https://ejemplo.com/articulo")).toBe(false);
    expect(isImageUrl("mira esto https://ejemplo.com/foto.png")).toBe(false);
    expect(isImageUrl("foto.png")).toBe(false);
    expect(isImageUrl("")).toBe(false);
  });
});
