import { describe, expect, it } from "vitest";
import { countWords } from "./word-count";

describe("countWords", () => {
  it("cuenta palabras de HTML Tiptap ignorando etiquetas", () => {
    expect(countWords("<p>hola mundo cruel</p>")).toBe(3);
  });

  it("trata los saltos de bloque como separadores", () => {
    expect(countWords("<p>uno</p><p>dos</p><li>tres</li>")).toBe(3);
  });

  it("colapsa espacios y entidades", () => {
    expect(countWords("<p>uno&nbsp;dos&nbsp;&nbsp;tres</p>")).toBe(3);
  });

  it("vacío o nulo cuenta cero", () => {
    expect(countWords(null)).toBe(0);
    expect(countWords("")).toBe(0);
    expect(countWords("<p></p>")).toBe(0);
    expect(countWords("   ")).toBe(0);
  });
});
