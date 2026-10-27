/**
 * Criterio: la nota de voz del catálogo es audio de verdad, no una ruta que no
 * existe. Es un WAV que un navegador decodifica (cabecera RIFF de PCM con su
 * duración) y su onda tiene forma de voz: sílabas altas y pausas, no una barra
 * plana. Así el specimen de AudioWave enseña la onda y suena.
 */
import { describe, expect, it } from "vitest";
import { picosDe } from "@/features/captures/audio-peaks";
import { muestrasDeNota, TASA_DE_LA_NOTA, wavDe } from "./nota-de-voz";

describe("la nota de voz del catálogo", () => {
  it("es un WAV de PCM de 16 bits con la duración pedida", async () => {
    const muestras = muestrasDeNota(3);
    const bytes = new DataView(await wavDe(muestras).arrayBuffer());
    const texto = (desde: number) => String.fromCharCode(...[0, 1, 2, 3].map((i) => bytes.getUint8(desde + i)));

    expect(texto(0)).toBe("RIFF");
    expect(texto(8)).toBe("WAVE");
    expect(bytes.getUint16(22, true)).toBe(1);
    expect(bytes.getUint32(24, true)).toBe(TASA_DE_LA_NOTA);
    expect(bytes.getUint16(34, true)).toBe(16);
    expect(bytes.getUint32(40, true)).toBe(3 * TASA_DE_LA_NOTA * 2);
  });

  it("su onda tiene sílabas y pausas, no una barra plana", () => {
    const picos = picosDe(muestrasDeNota(4));

    expect(Math.max(...picos)).toBe(1);
    expect(picos.filter((p) => p < 0.35).length).toBeGreaterThanOrEqual(4);
    expect(picos.filter((p) => p > 0.7).length).toBeGreaterThanOrEqual(8);
  });
});
