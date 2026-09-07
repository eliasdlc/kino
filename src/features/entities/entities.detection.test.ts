import { describe, it, expect } from "vitest";
import {
  detectMentions,
  plainTextFromHtml,
  type DetectableEntity,
} from "./entities.detection";

const kael: DetectableEntity = { id: "e-kael", name: "Kael", aliases: ["el Errante"] };
const puente: DetectableEntity = { id: "e-puente", name: "Puente Gris" };
const luffy: DetectableEntity = {
  id: "e-luffy",
  name: "Luffy",
  aliases: ["Sombrero de Paja"],
};

describe("detectMentions", () => {
  it("cuenta apariciones por nombre", () => {
    const counts = detectMentions("Kael cruzó. Luego Kael volvió.", [kael]);
    expect(counts.get("e-kael")).toBe(2);
  });

  it("respeta límites de palabra (no cuenta dentro de otra palabra)", () => {
    const counts = detectMentions("Kaelthas no es Kael.", [kael]);
    expect(counts.get("e-kael")).toBe(1);
  });

  it("es case-insensitive", () => {
    const counts = detectMentions("KAEL, kael y Kael.", [kael]);
    expect(counts.get("e-kael")).toBe(3);
  });

  it("cuenta aliases y los suma al nombre", () => {
    const counts = detectMentions("Kael, el Errante, cruzó el puente.", [kael]);
    expect(counts.get("e-kael")).toBe(2);
  });

  it("soporta nombres y aliases multi-palabra", () => {
    const counts = detectMentions(
      "Luffy es el Sombrero de Paja. Sombrero de Paja al ataque.",
      [luffy],
    );
    expect(counts.get("e-luffy")).toBe(3);
  });

  it("distingue entidades distintas en el mismo texto", () => {
    const counts = detectMentions("Kael cruzó el Puente Gris al amanecer.", [
      kael,
      puente,
    ]);
    expect(counts.get("e-kael")).toBe(1);
    expect(counts.get("e-puente")).toBe(1);
  });

  it("prefiere el término más largo y no doble-cuenta solapes", () => {
    // "Kael Draven" contiene el alias "Kael": debe contar una sola vez.
    const draven: DetectableEntity = { id: "e-d", name: "Kael Draven", aliases: ["Kael"] };
    const counts = detectMentions("Kael Draven llegó.", [draven]);
    expect(counts.get("e-d")).toBe(1);
  });

  it("no incluye entidades sin apariciones", () => {
    const counts = detectMentions("Nadie aquí.", [kael]);
    expect(counts.has("e-kael")).toBe(false);
  });

  it("texto vacío o sin entidades → mapa vacío", () => {
    expect(detectMentions("", [kael]).size).toBe(0);
    expect(detectMentions("Kael", []).size).toBe(0);
  });

  it("ignora aliases vacíos o whitespace", () => {
    const messy: DetectableEntity = { id: "e-m", name: "Zara", aliases: ["", "  "] };
    const counts = detectMentions("Zara habló.", [messy]);
    expect(counts.get("e-m")).toBe(1);
  });
});

describe("plainTextFromHtml", () => {
  it("extrae texto de párrafos separándolos con espacio", () => {
    expect(plainTextFromHtml("<p>Kael</p><p>cruzó</p>")).toBe("Kael cruzó");
  });

  it("decodifica entidades básicas y quita etiquetas", () => {
    expect(plainTextFromHtml("<p>t&eacute;<strong>Kael</strong> &amp; Zara</p>")).toContain(
      "Kael",
    );
    expect(plainTextFromHtml("<p>a &amp; b</p>")).toBe("a & b");
  });

  it("null/undefined → cadena vacía", () => {
    expect(plainTextFromHtml(null)).toBe("");
    expect(plainTextFromHtml(undefined)).toBe("");
  });
});
