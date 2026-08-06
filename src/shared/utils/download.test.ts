import { describe, expect, it } from "vitest";
import { slugify } from "./download";

describe("slugify", () => {
  it("convierte un título en un nombre de archivo seguro", () => {
    expect(slugify("La marea baja")).toBe("la-marea-baja");
  });

  it("quita los acentos en vez de comerse la letra", () => {
    expect(slugify("Canción de cuna")).toBe("cancion-de-cuna");
    expect(slugify("El niño y la ñ")).toBe("el-nino-y-la-n");
  });

  it("no deja guiones sueltos en los bordes", () => {
    expect(slugify("¿Quién cerró la puerta?")).toBe("quien-cerro-la-puerta");
  });

  it("un título vacío o impronunciable cae a un nombre válido", () => {
    expect(slugify("")).toBe("sin-titulo");
    expect(slugify("¿¡!?")).toBe("sin-titulo");
  });
});
