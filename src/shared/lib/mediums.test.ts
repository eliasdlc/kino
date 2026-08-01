import { describe, expect, it } from "vitest";
import {
  DEFAULT_MEDIUM,
  MEDIUM_CONFIG,
  MEDIUM_IDS,
  MEDIUM_OPTIONS,
  parseMediumValue,
  resolveMedium,
} from "./mediums";

describe("resolveMedium", () => {
  it("lee el id tipado que escribe W3", () => {
    expect(resolveMedium({ medium: "screenplay" })).toBe("screenplay");
    expect(resolveMedium({ medium: "webtoon" })).toBe("webtoon");
  });

  it("normaliza el texto libre en español que guardaron W1/W2", () => {
    expect(resolveMedium({ medium: "novela" })).toBe("novel");
    expect(resolveMedium({ medium: "Cómic" })).toBe("comic");
    expect(resolveMedium({ medium: "  GUIÓN " })).toBe("screenplay");
    expect(resolveMedium({ medium: "blog" })).toBe("serial");
  });

  it("cae al campo legacy `kind` antes de rendirse", () => {
    expect(resolveMedium({ kind: "manga" })).toBe("manga");
    // `medium` manda cuando ambos existen.
    expect(resolveMedium({ medium: "novela", kind: "manga" })).toBe("novel");
  });

  it("usa el default cuando no hay nada legible", () => {
    expect(resolveMedium(null)).toBe(DEFAULT_MEDIUM);
    expect(resolveMedium({})).toBe(DEFAULT_MEDIUM);
    expect(resolveMedium({ medium: 42 })).toBe(DEFAULT_MEDIUM);
    expect(resolveMedium({ medium: "algo que nadie escribió" })).toBe(DEFAULT_MEDIUM);
  });

  it("parseMediumValue distingue no-reconocido de default", () => {
    expect(parseMediumValue("otro")).toBe("other");
    expect(parseMediumValue("zzz")).toBeNull();
    expect(parseMediumValue(undefined)).toBeNull();
  });
});

describe("MEDIUM_CONFIG", () => {
  it("cada manifiesto se declara con su propio id", () => {
    for (const id of MEDIUM_IDS) {
      expect(MEDIUM_CONFIG[id].id).toBe(id);
    }
  });

  it("todo id es aceptado por el enum del formulario y viceversa", () => {
    expect(MEDIUM_OPTIONS.map((o) => o.value).sort()).toEqual([...MEDIUM_IDS].sort());
    for (const option of MEDIUM_OPTIONS) {
      expect(parseMediumValue(option.value)).toBe(option.value);
    }
  });

  it("solo el guion exporta a Fountain", () => {
    for (const id of MEDIUM_IDS) {
      const manifest = MEDIUM_CONFIG[id];
      const isScreenplay = manifest.exportFormat === "screenplay";
      expect(manifest.exportExtension === "fountain").toBe(isScreenplay);
      expect(manifest.screenplayKeys).toBe(isScreenplay);
    }
  });

  it("la plantilla estructurada solo existe donde hay bloques que estructurar", () => {
    expect(MEDIUM_CONFIG.novel.template).toBe("");
    expect(MEDIUM_CONFIG.serial.template).toBe("");
    expect(MEDIUM_CONFIG.manga.template).toContain("data-panel");
    expect(MEDIUM_CONFIG.webtoon.template).toContain("data-panel");
    expect(MEDIUM_CONFIG.webtoon.template).not.toContain("data-manga-page");
    expect(MEDIUM_CONFIG.screenplay.template).toContain('data-sp="sceneHeading"');
  });
});
