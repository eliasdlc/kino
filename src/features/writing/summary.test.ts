import { describe, expect, it } from "vitest";
import { keyTerms, splitSentences, summarize } from "./summary";

const CHAPTER = [
  "La niebla no levantó ese día, ni el siguiente.",
  "Aurelia lo anotó en el margen del mapa, con la letra pequeña que usaba para lo que no quería que nadie leyera.",
  "—No.",
  "El puerto seguía ahí abajo, respirando, y los barcos habían dejado de salir hacía dos semanas.",
  "Bruno la encontró en el taller, con la carta desplegada y la tinta de la niebla todavía fresca.",
].join(" ");

describe("splitSentences", () => {
  it("parte por punto, interrogación y exclamación", () => {
    expect(splitSentences("Uno. ¿Dos? ¡Tres! Cuatro")).toEqual([
      "Uno.",
      "¿Dos?",
      "¡Tres!",
      "Cuatro",
    ]);
  });

  it("parte también por salto de línea: un párrafo suelto es una unidad", () => {
    expect(splitSentences("Un párrafo sin punto\nOtro párrafo")).toEqual([
      "Un párrafo sin punto",
      "Otro párrafo",
    ]);
  });

  it("normaliza los espacios y descarta lo vacío", () => {
    expect(splitSentences("  Uno   dos.  \n\n  ")).toEqual(["Uno dos."]);
  });

  it("un texto vacío no produce frases", () => {
    expect(splitSentences("")).toEqual([]);
    expect(splitSentences("   \n ")).toEqual([]);
  });
});

describe("summarize", () => {
  it("devuelve frases literales del texto: no escribe nada nuevo", () => {
    const out = summarize({ text: CHAPTER, limit: 3 });
    for (const sentence of out) {
      expect(CHAPTER).toContain(sentence.text);
    }
  });

  it("las devuelve en orden de lectura, no por puntuación", () => {
    const out = summarize({ text: CHAPTER, limit: 3 });
    const positions = out.map((s) => s.position);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it("descarta las frases demasiado cortas para resumir nada", () => {
    const out = summarize({ text: CHAPTER, limit: 5 });
    expect(out.map((s) => s.text)).not.toContain("—No.");
  });

  it("respeta el límite pedido", () => {
    expect(summarize({ text: CHAPTER, limit: 2 })).toHaveLength(2);
    expect(summarize({ text: CHAPTER, limit: 0 })).toHaveLength(1);
  });

  it("reconoce las entidades del codex nombradas en cada frase", () => {
    const out = summarize({
      text: CHAPTER,
      entityNames: ["Aurelia", "Bruno", "Puerto Ceniza"],
      limit: 5,
    });
    const withAurelia = out.find((s) => s.text.includes("Aurelia"));
    expect(withAurelia?.entities).toEqual(["Aurelia"]);
  });

  it("reconoce la entidad aunque el texto la escriba con otra acentuación", () => {
    const out = summarize({
      text: "Kael cruzó el puente gris al amanecer y nadie volvió a verlo.",
      entityNames: ["Puente Grís"],
      limit: 1,
    });
    expect(out[0]!.entities).toEqual(["Puente Grís"]);
  });

  it("nombrar a alguien del codex pesa: esa frase entra antes", () => {
    // Las dos candidatas van después de la apertura, para que lo único que las
    // distinga sea la entidad: si no, ganaría el plus de la primera frase.
    const text = [
      "El invierno llegó antes de tiempo aquel año en la ciudad.",
      "Llovía sobre los tejados de la ciudad y el agua bajaba por las calles.",
      "Aurelia entró en el taller de la ciudad sin llamar a la puerta.",
    ].join(" ");
    const out = summarize({ text, entityNames: ["Aurelia"], limit: 2 });
    expect(out.map((s) => s.text).join(" ")).toContain("Aurelia");
    expect(out.map((s) => s.text).join(" ")).not.toContain("Llovía");
  });

  it("la frase que abre el capítulo pesa más que una del montón", () => {
    const text = [
      "Aquella mañana el puerto amaneció cubierto por la niebla.",
      "Después bajaron al muelle sin decirse una sola palabra.",
    ].join(" ");
    expect(summarize({ text, limit: 1 })[0]!.position).toBe(0);
  });

  it("un capítulo vacío o sin frases utilizables devuelve una lista vacía", () => {
    expect(summarize({ text: "" })).toEqual([]);
    expect(summarize({ text: "—No. —Sí." })).toEqual([]);
  });

  it("es determinista: dos llamadas dan lo mismo", () => {
    const a = summarize({ text: CHAPTER, limit: 3 });
    const b = summarize({ text: CHAPTER, limit: 3 });
    expect(b).toEqual(a);
  });
});

describe("keyTerms", () => {
  it("saca los términos repetidos del capítulo", () => {
    expect(keyTerms(CHAPTER)).toContain("niebla");
  });

  it("descarta las palabras vacías y las que solo aparecen una vez", () => {
    const terms = keyTerms(CHAPTER);
    expect(terms).not.toContain("para");
    expect(terms).not.toContain("respirando");
  });

  it("un texto vacío no da términos", () => {
    expect(keyTerms("")).toEqual([]);
  });
});
