/**
 * Criterio: ninguna acción que el backend escriba puede quedarse sin frase en
 * pantalla. Este test lee las acciones que `convex/` pasa de verdad a
 * `recordEvent` y comprueba que todas están en `VERBOS`, de modo que añadir un
 * escritor sin su copy rompe la batería en vez de pintar "hizo un cambio".
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { cuandoDe, sujetoDe, VERBOS } from "./item-events";

const CONVEX = path.resolve(__dirname, "../../../convex");

/** Los ficheros de funciones de Convex, sin sus tests ni lo generado. */
function fuentes(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entrada) => {
    const completo = path.join(dir, entrada.name);
    if (entrada.isDirectory()) return entrada.name === "_generated" ? [] : fuentes(completo);
    return entrada.name.endsWith(".ts") && !entrada.name.includes(".test.") ? [completo] : [];
  });
}

const ACCIONES = [
  ...new Set(
    fuentes(CONVEX)
      .flatMap((fichero) => [...readFileSync(fichero, "utf8").matchAll(/action: '([a-zA-Z]+\.[a-zA-Z]+)'/g)])
      .map((match) => match[1]!),
  ),
].sort();

describe("las frases del log", () => {
  it("el backend escribe acciones y todas se leen en español", () => {
    expect(ACCIONES.length).toBeGreaterThan(20);
    expect(ACCIONES.filter((accion) => VERBOS[accion] === undefined)).toEqual([]);
  });

  it("ninguna frase sobra: una que ya nadie escribe es copy muerto", () => {
    expect(Object.keys(VERBOS).filter((accion) => !ACCIONES.includes(accion))).toEqual([]);
  });
});

describe("el sujeto de la frase", () => {
  it("el agente propio se nombra como tuyo y el ajeno no lleva nombre", () => {
    expect(sujetoDe({ kind: "propio", channel: "oauth", name: "Elias" })).toBe("Tu agente");
    expect(sujetoDe({ kind: "propio", channel: "session", name: "Elias" })).toBe("Tú");
    expect(sujetoDe({ kind: "redactado", channel: "session" })).toBe("Otra persona");
    expect(sujetoDe({ kind: "redactado", channel: "oauth" })).toBe("El agente de otra persona");
  });

  it("las dos vías sin persona detrás dicen qué las movió", () => {
    expect(sujetoDe({ kind: "redactado", channel: "sync" })).toContain("GitHub");
    expect(sujetoDe({ kind: "redactado", channel: "system" })).toBe("La repetición automática");
  });
});

describe("cuándo pasó", () => {
  const ahora = Date.parse("2026-09-08T18:00:00.000Z");
  const hace = (ms: number) => new Date(ahora - ms).toISOString();

  it("relativo mientras la memoria alcanza", () => {
    expect(cuandoDe(hace(120_000), ahora)).toBe("hace 2 minutos");
    expect(cuandoDe(hace(3 * 3_600_000), ahora)).toBe("hace 3 horas");
    expect(cuandoDe(hace(2 * 86_400_000), ahora)).toBe("anteayer");
  });

  it("a partir de la semana, la fecha entera: 'hace 9 días' obliga a hacer la resta", () => {
    expect(cuandoDe(hace(9 * 86_400_000), ahora)).toBe("30 de agosto de 2026");
  });
});
