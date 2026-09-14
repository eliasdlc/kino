/**
 * Criterio: escribir la sintaxis de Markdown crea un enlace, y sólo cuando lo
 * que va entre paréntesis se puede servir de verdad. Un esquema que el
 * saneador borraría (`javascript:`) no puede llegar a marcarse como enlace.
 */
import { describe, expect, it } from "vitest";
import { MARKDOWN_LINK, parseMarkdownLink } from "./link-markdown";

function match(input: string) {
  const found = input.match(MARKDOWN_LINK);
  return found ? parseMarkdownLink(found[1], found[2]) : null;
}

describe("link-markdown", () => {
  it("enlaza el texto, no la dirección", () => {
    expect(match("[guía del ciclo](https://pucmm.edu.do)")).toEqual({
      text: "guía del ciclo",
      href: "https://pucmm.edu.do",
    });
  });

  it("completa el esquema de una dirección escrita a secas", () => {
    expect(match("[la PVA](pva.pucmm.edu.do/curso/1)")).toEqual({
      text: "la PVA",
      href: "https://pva.pucmm.edu.do/curso/1",
    });
  });

  it("acepta un correo", () => {
    expect(match("[escríbele](mailto:profe@pucmm.edu.do)")?.href).toBe("mailto:profe@pucmm.edu.do");
  });

  it("no enlaza un esquema que el saneador borraría", () => {
    expect(match("[ojo](javascript:alert(1))")).toBeNull();
  });

  it("no dispara con texto que no es un enlace", () => {
    expect(match("[pendiente] terminar la práctica")).toBeNull();
    expect(match("[texto] (con espacio)")).toBeNull();
  });

  it("sólo dispara al cerrar el paréntesis", () => {
    expect(match("[guía](https://pucmm.edu.do")).toBeNull();
  });
});
