import { describe, expect, it } from "vitest";
import {
  SNIPPET_CLOSE,
  SNIPPET_OPEN,
  splitSnippet,
  toTsQueryText,
} from "./search.types";

/** Igual que lo monta `ts_headline` con las opciones del servicio. */
const mark = (text: string) => `${SNIPPET_OPEN}${text}${SNIPPET_CLOSE}`;

describe("toTsQueryText", () => {
  it("marca la última palabra como prefijo, que es lo que sirve al Cmd+K", () => {
    expect(toTsQueryText("esc")).toBe("esc:*");
  });

  it("combina varias palabras con AND y deja el prefijo sólo en la última", () => {
    expect(toTsQueryText("ana cancion")).toBe("ana & cancion:*");
  });

  // Sin esto, un término del usuario podría inyectar operadores de tsquery.
  it("descarta todo lo que no sea letra o dígito", () => {
    expect(toTsQueryText("ana & cancion:*")).toBe("ana & cancion:*");
    expect(toTsQueryText("uno | dos")).toBe("uno & dos:*");
    expect(toTsQueryText("!(nada)")).toBe("nada:*");
  });

  it("conserva acentos y eñes: el unaccent lo aplica Postgres, no esto", () => {
    expect(toTsQueryText("canción")).toBe("canción:*");
    expect(toTsQueryText("año")).toBe("año:*");
  });

  it("colapsa los espacios de más", () => {
    expect(toTsQueryText("  ana   cancion  ")).toBe("ana & cancion:*");
  });

  // Quien llama tiene que cortar aquí: `to_tsquery('')` es un error en Postgres.
  it("devuelve cadena vacía cuando no queda nada buscable", () => {
    expect(toTsQueryText("!!!")).toBe("");
    expect(toTsQueryText("   ")).toBe("");
  });
});

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
