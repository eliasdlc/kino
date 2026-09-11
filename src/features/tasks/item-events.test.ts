/**
 * Criterio: ninguna acción que el backend escriba puede quedarse sin frase en
 * pantalla ni sin declarar si se deshace. Este test lee las acciones que
 * `convex/` pasa de verdad a `recordEvent` y las cruza con `FRASES` y con
 * `DESHACER`, de modo que añadir un escritor sin su copy o sin su forma de
 * deshacer rompe la batería en vez de pintar "hizo un cambio" o un botón que
 * no sabe qué hacer.
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ACCION_DESHACER, DESHACER } from "@convex/eventLog";
import { cuandoDe, FRASES, sujetoDe } from "./item-events";

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
  it("el backend escribe acciones y todas se leen en español y saben si se deshacen", () => {
    expect(ACCIONES.length).toBeGreaterThan(20);
    expect(ACCIONES.filter((accion) => FRASES[accion] === undefined)).toEqual([]);
    expect(ACCIONES.filter((accion) => DESHACER[accion] === undefined)).toEqual([]);
  });

  it("las dos tablas cubren el mismo conjunto: una acción no puede tener frase y no forma, ni al revés", () => {
    expect(Object.keys(FRASES).sort()).toEqual(Object.keys(DESHACER).sort());
  });

  it("ninguna frase sobra: una que ya nadie escribe es copy muerto", () => {
    // La del propio deshacer no sale del `grep` porque su acción es una
    // constante, no un literal en la llamada.
    const escritas = [...ACCIONES, ACCION_DESHACER];
    expect(Object.keys(FRASES).filter((accion) => !escritas.includes(accion))).toEqual([]);
  });

  it("toda acción sabe decirse en singular y en plural: la fila diaria cuenta", () => {
    for (const [accion, frase] of Object.entries(FRASES)) {
      expect(frase.resumen(1), accion).toMatch(/^1 /);
      expect(frase.resumen(4), accion).toMatch(/^4 /);
      expect(frase.resumen(4), accion).not.toBe(frase.resumen(1).replace("1", "4"));
      expect(frase.verbo.length, accion).toBeGreaterThan(2);
      // La clase es el singular tal cual, que es lo que deja ver que dos
      // tramos seguidos hablan de lo mismo.
      expect(frase.resumen(1), accion).toBe(`1 ${frase.clase}`);
    }
  });

  it("toda forma `no` trae su motivo escrito, que es lo que la fila enseña en vez del botón", () => {
    const sinMotivo = Object.entries(DESHACER).filter(([, como]) => como.forma === "no" && como.motivo.trim() === "");
    expect(sinMotivo).toEqual([]);
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
