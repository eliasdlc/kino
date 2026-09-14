/**
 * Criterio: lo que se manda al servidor sale del registro y no de una suposición.
 * Un texto y un enlace no suben nada, porque no tienen nada que subir; una foto
 * y un audio suben su archivo y llevan su ruta.
 */
import { describe, expect, it, vi } from "vitest";
import { prepararCaptura } from "./subirCaptura";
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

describe("prepararCaptura", () => {
  it("un enlace viaja como enlace y no sube nada", async () => {
    const subir = vi.fn();

    const args = await prepararCaptura(registro({ kind: "link", url: "https://react.dev" }), subir);

    expect(args).toEqual({ kind: "link", url: "https://react.dev" });
    expect(subir).not.toHaveBeenCalled();
  });

  it("un texto viaja como texto y tampoco sube nada", async () => {
    const subir = vi.fn();

    const args = await prepararCaptura(registro({ kind: "text", text: "idea" }), subir);

    expect(args).toEqual({ kind: "text", text: "idea" });
    expect(subir).not.toHaveBeenCalled();
  });

  it("una foto sube su archivo y lleva la ruta que le devolvieron", async () => {
    const blob = new Blob([new Uint8Array(8)], { type: "image/jpeg" });
    const subir = vi.fn(async () => "https://cdn.kino/pizarra.jpg");

    const args = await prepararCaptura(registro({ kind: "photo", blob, size: 8 }), subir);

    expect(subir).toHaveBeenCalledExactlyOnceWith(blob);
    expect(args).toEqual({ kind: "photo", blobPath: "https://cdn.kino/pizarra.jpg" });
  });

  it("si la subida falla, el error sube y el registro se queda en la cola", async () => {
    const blob = new Blob([new Uint8Array(8)], { type: "audio/mp4" });
    const subir = vi.fn(async () => {
      throw new Error("sin red");
    });

    await expect(prepararCaptura(registro({ kind: "voice", blob }), subir)).rejects.toThrow("sin red");
  });
});
