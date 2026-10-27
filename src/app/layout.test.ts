/**
 * Criterio: la interfaz se compone con Figtree, los títulos con Bricolage y
 * la voz con Literata en itálica; JetBrains Mono existe para el código y no
 * se precarga. Inter ya no entra en el bundle. El `themeColor` de la barra del
 * navegador es el papel de cada modo, no un blanco o un negro genérico.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const fuente = readFileSync(join(__dirname, "layout.tsx"), "utf8");

describe("las caras del layout", () => {
  it("Figtree es la cara de la interfaz e Inter no aparece", () => {
    expect(fuente).toMatch(/Figtree\(\{[^}]*variable: "--font-figtree"/);
    expect(fuente).not.toMatch(/\bInter\b/);
  });

  it("Literata entra en regular y en itálica como voz", () => {
    expect(fuente).toMatch(/Literata\(\{[^}]*style: \["normal", "italic"\]/);
    expect(fuente).toContain("--font-literata");
  });

  it("JetBrains Mono no se precarga", () => {
    expect(fuente).toMatch(/JetBrains_Mono\(\{[^}]*preload: false/);
  });

  it("el themeColor es el papel de cada modo", () => {
    expect(fuente).toContain('color: "#f8f5ef"');
    expect(fuente).toContain('color: "#171512"');
  });
});
