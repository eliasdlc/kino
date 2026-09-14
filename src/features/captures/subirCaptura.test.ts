/**
 * Criterio: una foto de teléfono se comprime antes de subirla, y cuando algo
 * falla se dice **qué** falló. Sin esto, compartir una foto de 5,6 MB devolvía
 * 413 y la pantalla lo contaba como falta de red: prometía que saldría sola
 * cuando no iba a salir nunca.
 */
import { describe, expect, it, vi } from "vitest";
import {
  FalloAlSubir,
  LADO_MAXIMO,
  prepararCaptura,
  TOPE_BYTES,
  type HerramientasDeSubida,
} from "./subirCaptura";
import type { RegistroCompartido } from "./shareTarget";

function registro(campos: Partial<RegistroCompartido>): RegistroCompartido {
  return {
    id: "reg-1",
    ownerId: "user-1",
    kind: "text",
    name: null,
    size: 0,
    text: null,
    url: null,
    receivedAt: 1_757_800_000_000,
    estado: "pendiente",
    blob: null,
    ...campos,
  };
}

/** Un blob de los bytes que se le pidan, para medir topes sin gastar memoria. */
function pesando(bytes: number, type = "image/jpeg"): Blob {
  const blob = new Blob(["x"], { type });
  Object.defineProperty(blob, "size", { value: bytes });
  return blob;
}

function herramientas(overrides: Partial<HerramientasDeSubida> = {}): HerramientasDeSubida {
  return {
    comprimir: vi.fn(async () => pesando(300_000, "image/webp")),
    subir: vi.fn(async () => "https://cdn.kino/pizarra.webp"),
    ...overrides,
  };
}

describe("prepararCaptura", () => {
  it("un enlace viaja como enlace y no sube nada", async () => {
    const h = herramientas();

    const args = await prepararCaptura(registro({ kind: "link", url: "https://react.dev" }), h);

    expect(args).toEqual({ kind: "link", url: "https://react.dev" });
    expect(h.subir).not.toHaveBeenCalled();
  });

  it("un texto viaja como texto y tampoco sube nada", async () => {
    const h = herramientas();

    const args = await prepararCaptura(registro({ kind: "text", text: "idea" }), h);

    expect(args).toEqual({ kind: "text", text: "idea" });
    expect(h.subir).not.toHaveBeenCalled();
  });

  it("una foto de teléfono se comprime antes de subirla", async () => {
    const foto = pesando(5_600_000);
    const h = herramientas();

    const args = await prepararCaptura(registro({ kind: "photo", blob: foto, name: "pizarra.jpg" }), h);

    expect(h.comprimir).toHaveBeenCalledOnce();
    expect(h.comprimir).toHaveBeenCalledWith(expect.any(File), { maxDim: LADO_MAXIMO });
    // Lo que se sube es lo comprimido, no el original de 5,6 MB.
    expect((h.subir as ReturnType<typeof vi.fn>).mock.calls[0]![0].size).toBe(300_000);
    expect(args).toEqual({ kind: "photo", blobPath: "https://cdn.kino/pizarra.webp" });
  });

  it("un audio no se comprime: no hay cómo, y se sube tal cual", async () => {
    const voz = pesando(900_000, "audio/mp4");
    const h = herramientas();

    await prepararCaptura(registro({ kind: "voice", blob: voz, name: "nota.m4a" }), h);

    expect(h.comprimir).not.toHaveBeenCalled();
    expect(h.subir).toHaveBeenCalledOnce();
  });

  it("si el navegador no sabe decodificar la foto, se intenta con el original", async () => {
    const heic = pesando(1_000_000, "image/heic");
    const h = herramientas({
      comprimir: vi.fn(async () => {
        throw new Error("formato desconocido");
      }),
    });

    const args = await prepararCaptura(registro({ kind: "photo", blob: heic }), h);

    expect(args.blobPath).toBe("https://cdn.kino/pizarra.webp");
  });

  it("lo que sigue pasando del tope se rechaza diciendo el motivo, no se sube a ciegas", async () => {
    const enorme = pesando(TOPE_BYTES + 1);
    const h = herramientas({ comprimir: vi.fn(async () => pesando(TOPE_BYTES + 1, "image/webp")) });

    const fallo = await prepararCaptura(registro({ kind: "photo", blob: enorme }), h).catch((e) => e);

    expect(fallo).toBeInstanceOf(FalloAlSubir);
    expect(fallo.motivo).toBe("demasiado-grande");
    expect(h.subir).not.toHaveBeenCalled();
  });

  it("una nota de voz demasiado larga lo dice con sus palabras", async () => {
    const larga = pesando(TOPE_BYTES + 1, "audio/mp4");

    const fallo = await prepararCaptura(registro({ kind: "voice", blob: larga }), herramientas()).catch((e) => e);

    expect(fallo.motivo).toBe("demasiado-grande");
    expect(fallo.message).toContain("nota de voz");
  });

  it("el fallo de la subida sube con su motivo, no como un error cualquiera", async () => {
    const h = herramientas({
      subir: vi.fn(async () => {
        throw new FalloAlSubir("sin-red", "No hay conexión ahora mismo.");
      }),
    });

    const fallo = await prepararCaptura(registro({ kind: "photo", blob: pesando(100) }), h).catch((e) => e);

    expect(fallo.motivo).toBe("sin-red");
  });
});
