/**
 * Criterio: una nota de voz demasiado grande no se descarga ni se decodifica
 * para dibujar su onda: el tamaño se lee en la cabecera antes del cuerpo. Una
 * de tamaño normal sí se decodifica. El control de reproducir está siempre.
 */
import { screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderMobile } from "@/shared/testing/render";
import { AudioWave, BYTES_MAXIMOS_DE_ONDA } from "./AudioWave";

const decodificar = vi.fn(async () => ({ getChannelData: () => new Float32Array(400).fill(0.5) }));

class ContextoFalso {
  decodeAudioData = decodificar;
  close = vi.fn(async () => {});
}

function servir(bytes: number) {
  const leerCuerpo = vi.fn(async () => new ArrayBuffer(Math.min(bytes, 1024)));
  const cancelar = vi.fn(async () => {});
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      headers: new Headers({ "content-length": String(bytes) }),
      body: { cancel: cancelar },
      arrayBuffer: leerCuerpo,
    })),
  );
  return { leerCuerpo, cancelar };
}

afterEach(() => {
  vi.unstubAllGlobals();
  decodificar.mockClear();
});

describe("AudioWave", () => {
  it("por encima del tope no lee el cuerpo ni decodifica", async () => {
    vi.stubGlobal("AudioContext", ContextoFalso);
    const { leerCuerpo, cancelar } = servir(BYTES_MAXIMOS_DE_ONDA + 1);

    renderMobile(<AudioWave src="blob:kino/larga" segundos={1200} />);

    await waitFor(() => expect(cancelar).toHaveBeenCalled());
    expect(leerCuerpo).not.toHaveBeenCalled();
    expect(decodificar).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Reproducir la nota de voz" })).toBeVisible();
  });

  it("una nota normal se decodifica para dibujar su onda", async () => {
    vi.stubGlobal("AudioContext", ContextoFalso);
    const { leerCuerpo } = servir(200_000);

    renderMobile(<AudioWave src="blob:kino/corta" segundos={30} />);

    await waitFor(() => expect(decodificar).toHaveBeenCalledOnce());
    expect(leerCuerpo).toHaveBeenCalledOnce();
  });
});
