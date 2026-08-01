import { describe, expect, it } from "vitest";
import { buildExcerpts, toPlainText } from "./story-text";

describe("toPlainText", () => {
  it("separa los bloques en vez de pegar sus palabras", () => {
    expect(toPlainText("<p>Kael cruzó</p><p>el puente</p>")).toBe("Kael cruzó el puente");
  });

  it("quita el marcado de énfasis sin partir la frase", () => {
    expect(toPlainText("<p>la <em>daga</em> gris</p>")).toBe("la daga gris");
  });

  it("resuelve las entidades HTML del editor", () => {
    expect(toPlainText("<p>t&uacute; &amp; yo &lt;3</p>")).toBe("t&uacute; & yo <3");
  });

  it("un contenido vacío o nulo da cadena vacía", () => {
    expect(toPlainText(null)).toBe("");
    expect(toPlainText("")).toBe("");
  });
});

describe("buildExcerpts", () => {
  it("encuentra una frase partida por marcado en el HTML original", () => {
    const text = toPlainText("<p>Sacó la <strong>daga</strong> del cinto.</p>");
    expect(buildExcerpts(text, "la daga")).toHaveLength(1);
  });

  it("es insensible a mayúsculas", () => {
    expect(buildExcerpts("El Puente Gris al amanecer", "puente gris")).toHaveLength(1);
  });

  it("recorta con elipsis cuando el fragmento no llega a los bordes", () => {
    const filler = "palabra ".repeat(40);
    const [excerpt] = buildExcerpts(`${filler}daga${filler}`, "daga");
    expect(excerpt!.startsWith("…")).toBe(true);
    expect(excerpt!.endsWith("…")).toBe(true);
    expect(excerpt).toContain("daga");
  });

  it("no pone elipsis si el texto entero cabe en el fragmento", () => {
    const [excerpt] = buildExcerpts("Sacó la daga.", "daga");
    expect(excerpt).toBe("Sacó la daga.");
  });

  it("corta a tres coincidencias por capítulo", () => {
    expect(buildExcerpts("daga ".repeat(10), "daga")).toHaveLength(3);
  });

  it("sin coincidencias devuelve lista vacía", () => {
    expect(buildExcerpts("Kael cruzó el puente", "espada")).toEqual([]);
    expect(buildExcerpts("Kael", "")).toEqual([]);
  });
});
