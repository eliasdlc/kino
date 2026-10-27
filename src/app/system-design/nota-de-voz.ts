/**
 * Una nota de voz de muestra para el catálogo, generada aquí y no guardada como
 * archivo: el specimen de AudioWave necesita un audio que el navegador pueda
 * decodificar para dibujar la onda y reproducir. Suena como un murmullo con
 * sílabas: una voz grave con armónicos, modulada en golpes de unos 4 por
 * segundo, con pausas entre frases.
 */

/** Muestras por segundo: de sobra para una voz, pocas para que el WAV pese poco. */
export const TASA_DE_LA_NOTA = 8000;

/** Lo alto de cada sílaba en una frase, del 0 al 1; el 0 es una pausa. */
const SILABAS = [0.55, 0.9, 0.7, 1, 0.45, 0, 0.8, 0.6, 0.95, 0.5, 0.75, 0, 0, 0.65, 1, 0.85, 0.4];

export function muestrasDeNota(segundos: number, tasa = TASA_DE_LA_NOTA): Float32Array {
  const total = Math.round(segundos * tasa);
  const muestras = new Float32Array(total);
  const porSilaba = Math.round(tasa / 4);
  for (let i = 0; i < total; i += 1) {
    const t = i / tasa;
    const silaba = Math.floor(i / porSilaba);
    const dentro = (i % porSilaba) / porSilaba;
    // La envolvente sube y baja dentro de cada sílaba, como una voz.
    const envolvente = (SILABAS[silaba % SILABAS.length] ?? 0) * Math.sin(Math.PI * dentro) ** 2;
    const voz = Math.sin(2 * Math.PI * 140 * t) + 0.5 * Math.sin(2 * Math.PI * 280 * t) + 0.25 * Math.sin(2 * Math.PI * 420 * t);
    muestras[i] = (envolvente * voz) / 1.75;
  }
  return muestras;
}

/** Las muestras como WAV de PCM mono de 16 bits. */
export function wavDe(muestras: Float32Array, tasa = TASA_DE_LA_NOTA): Blob {
  const datos = muestras.length * 2;
  const vista = new DataView(new ArrayBuffer(44 + datos));
  const escribir = (desde: number, texto: string) => {
    for (let i = 0; i < texto.length; i += 1) vista.setUint8(desde + i, texto.charCodeAt(i));
  };
  escribir(0, "RIFF");
  vista.setUint32(4, 36 + datos, true);
  escribir(8, "WAVE");
  escribir(12, "fmt ");
  vista.setUint32(16, 16, true);
  vista.setUint16(20, 1, true);
  vista.setUint16(22, 1, true);
  vista.setUint32(24, tasa, true);
  vista.setUint32(28, tasa * 2, true);
  vista.setUint16(32, 2, true);
  vista.setUint16(34, 16, true);
  escribir(36, "data");
  vista.setUint32(40, datos, true);
  muestras.forEach((muestra, i) => vista.setInt16(44 + i * 2, Math.max(-1, Math.min(1, muestra)) * 0x7fff, true));
  return new Blob([vista.buffer], { type: "audio/wav" });
}
