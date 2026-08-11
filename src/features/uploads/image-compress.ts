/**
 * Compresión de imágenes client-side a WebP (Writing W2, §5.3). Reduce las
 * referencias a ~100–200KB antes de subirlas, así el free tier de 1GB de Blob da
 * para miles. Corre en el navegador (canvas); el server solo recibe el WebP ya listo.
 */

/** Escala manteniendo proporción para que el lado mayor no exceda `maxDim`. */
export function computeTargetDimensions(
  width: number,
  height: number,
  maxDim: number,
): { width: number; height: number } {
  if (width <= 0 || height <= 0) return { width: 0, height: 0 };
  const longest = Math.max(width, height);
  if (longest <= maxDim) return { width, height };
  const scale = maxDim / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export interface CompressOptions {
  /** Lado mayor máximo en px. */
  maxDim?: number;
  /** Calidad WebP 0–1. */
  quality?: number;
}

export async function compressImageToWebp(
  file: File,
  { maxDim = 1600, quality = 0.82 }: CompressOptions = {},
): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  try {
    const { width, height } = computeTargetDimensions(bitmap.width, bitmap.height, maxDim);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No se pudo procesar la imagen");
    ctx.drawImage(bitmap, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", quality),
    );
    if (!blob) throw new Error("No se pudo comprimir la imagen");
    return blob;
  } finally {
    bitmap.close();
  }
}
