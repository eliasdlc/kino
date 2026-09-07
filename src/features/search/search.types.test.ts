import { describe, expect, it } from "vitest";
import { SNIPPET_CLOSE, SNIPPET_OPEN, splitSnippet } from "./search.types";

/** Igual que lo monta el servicio alrededor de la coincidencia. */
const mark = (text: string) => `${SNIPPET_OPEN}${text}${SNIPPET_CLOSE}`;

describe("splitSnippet", () => {
  it("separa el tramo resaltado del resto", () => {
    expect(splitSnippet(`una ${mark("cancion")} larga`)).toEqual([
      { text: "una ", match: false },
      { text: "cancion", match: true },
      { text: " larga", match: false },
    ]);
  });

  it("admite varias coincidencias", () => {
    expect(splitSnippet(`${mark("ana")} y ${mark("ana")}`)).toEqual([
      { text: "ana", match: true },
      { text: " y ", match: false },
      { text: "ana", match: true },
    ]);
  });

  it("sin marcas devuelve un solo tramo plano", () => {
    expect(splitSnippet("texto sin resaltar")).toEqual([
      { text: "texto sin resaltar", match: false },
    ]);
  });

  it("no pierde texto si falta la marca de cierre", () => {
    expect(splitSnippet(`inicio ${SNIPPET_OPEN}resto`)).toEqual([
      { text: "inicio ", match: false },
      { text: "resto", match: false },
    ]);
  });

  it("con la cadena vacía no devuelve tramos", () => {
    expect(splitSnippet("")).toEqual([]);
  });
});
