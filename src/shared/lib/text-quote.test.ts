import { describe, expect, it } from "vitest";
import { htmlToPlainText, locateQuote, normalizeForMatch } from "./text-quote";

// La misma cita tiene que encontrarse en el markdown que lee el agente y en el
// texto que guarda el editor, y una cita que no se puede ubicar sin adivinar
// tiene que decirlo en vez de anclarse a la primera que pase.

const TEXTO =
  "QSD tiene firewall perimetral y respaldos.\nLa información puede ser clasificada como prueba. " +
  "Más tarde, la información puede ser clasificada como debilidad.";

function citado(source: string, match: ReturnType<typeof locateQuote>) {
  if (match.status !== "found") throw new Error(`no encontrada: ${match.status}`);
  return source.slice(match.start, match.end);
}

describe("normalizeForMatch", () => {
  it("junta blancos, iguala comillas y guiones, y recuerda de dónde sale cada letra", () => {
    const { text, origin } = normalizeForMatch("«Hola»\n\n  mundo – sí");
    expect(text).toBe('"hola" mundo - sí');
    expect(origin[0]).toBe(0);
    expect(origin[text.indexOf("m")]).toBe("«Hola»\n\n  ".length);
  });

  it("desarrolla los puntos suspensivos del editor en los tres puntos del agente", () => {
    expect(normalizeForMatch("y luego…").text).toBe("y luego...");
  });
});

describe("locateQuote", () => {
  it("encuentra una cita única y devuelve el trozo original", () => {
    const match = locateQuote(TEXTO, { exact: "firewall perimetral" });
    expect(citado(TEXTO, match)).toBe("firewall perimetral");
  });

  it("perdona el énfasis de markdown y los saltos de línea al citar", () => {
    const match = locateQuote(TEXTO, { exact: "**respaldos.** La información" });
    expect(citado(TEXTO, match)).toBe("respaldos.\nLa información");
  });

  it("no encuentra lo que no está", () => {
    expect(locateQuote(TEXTO, { exact: "cortafuegos" })).toEqual({ status: "missing" });
    expect(locateQuote(TEXTO, { exact: "   " })).toEqual({ status: "missing" });
  });

  it("pide contexto cuando la cita se repite y no lo trae", () => {
    expect(locateQuote(TEXTO, { exact: "puede ser clasificada" })).toEqual({ status: "ambiguous", count: 2 });
  });

  it("elige la aparición cuyo sufijo coincide", () => {
    const match = locateQuote(TEXTO, { exact: "puede ser clasificada", suffix: "como debilidad" });
    expect(match.status).toBe("found");
    if (match.status !== "found") return;
    expect(TEXTO.slice(match.end)).toMatch(/^ como debilidad/);
  });

  it("elige la aparición cuyo prefijo coincide", () => {
    const match = locateQuote(TEXTO, { exact: "la información", prefix: "Más tarde," });
    expect(match.status).toBe("found");
    if (match.status !== "found") return;
    expect(TEXTO.slice(0, match.start)).toMatch(/Más tarde, $/);
  });
});

describe("htmlToPlainText", () => {
  it("separa los bloques y traduce las entidades que escribe el editor", () => {
    const html = "<p>Uno &amp; dos</p><p>tres&nbsp;&#8230;</p>";
    expect(htmlToPlainText(html).replace(/\s+/g, " ").trim()).toBe("Uno & dos tres …");
    expect(locateQuote(htmlToPlainText(html), { exact: "dos tres" }).status).toBe("found");
  });
});
