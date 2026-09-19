/**
 * El texto del toast del refresco. Lo que se prueba es que el aviso no aconseje
 * algo que no funciona: cuando la respuesta viene truncada hay que volver a
 * sincronizar, y el mensaje sólo vale si el refresco siguiente de verdad
 * continúa donde se quedó.
 */
import { describe, expect, it } from "vitest";
import { describeSyncResult } from "./github-sync.hooks";
import type { SyncResult } from "./github-sync.types";

const resultado = (over: Partial<SyncResult> = {}): SyncResult => ({
  imported: 0,
  updated: 0,
  unchanged: 0,
  sprintsCreated: 0,
  truncated: false,
  syncedAt: new Date().toISOString(),
  ...over,
});

describe("describeSyncResult", () => {
  it("sin novedades lo dice en una frase", () => {
    expect(describeSyncResult(resultado())).toBe("Todo estaba al día.");
  });

  it("cuenta lo que entró y lo que cambió", () => {
    expect(describeSyncResult(resultado({ imported: 2, updated: 1, sprintsCreated: 1 }))).toBe(
      "2 importada(s) · 1 actualizada(s) · 1 sprint(s) nuevo(s)",
    );
  });

  it("truncado avisa de que faltan y de que el siguiente refresco sigue desde ahí", () => {
    const texto = describeSyncResult(resultado({ imported: 300, truncated: true }));

    expect(texto).toContain("300 importada(s)");
    expect(texto).toContain("sigue desde donde se quedó");
  });

  // El defecto: con el tope de páginas alcanzado y ninguna tarjeta nueva, el
  // aviso decía que todo estaba al día mientras quedaban issues sin traer.
  it("truncado sin novedades no dice que todo estaba al día", () => {
    const texto = describeSyncResult(resultado({ truncated: true }));

    expect(texto).not.toContain("Todo estaba al día");
    expect(texto).toContain("Faltan issues por traer");
  });
});
