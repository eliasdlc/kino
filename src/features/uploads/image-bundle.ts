import type { ImageStorage } from "./image-storage";
import { assetFileName } from "./image-refs";

/**
 * Descarga imágenes propias para empaquetarlas en un export.
 *
 * El presupuesto no es opcional: la función corre en el free tier de Vercel con un
 * techo de 10s, y descargar imágenes es lo único del export que depende de la red.
 * Cuando se agota el presupuesto se para y se devuelve lo conseguido: el llamador
 * deja las imágenes restantes con su URL remota, que es peor que empaquetarlas pero
 * mucho mejor que devolver un 504 y ningún ZIP.
 */

export interface BundleBudget {
  /** Tope de imágenes descargadas. */
  maxImages: number;
  /** Tope acumulado de bytes en memoria. */
  maxTotalBytes: number;
  /** Milisegundos desde el arranque del barrido antes de dejar de empezar descargas. */
  deadlineMs: number;
  /** Descargas simultáneas. */
  concurrency: number;
}

export const DEFAULT_BUNDLE_BUDGET: BundleBudget = {
  maxImages: 200,
  maxTotalBytes: 25 * 1024 * 1024,
  deadlineMs: 6_000,
  concurrency: 6,
};

export interface BundledImages {
  /** Archivos a escribir dentro de la carpeta de assets del ZIP. */
  files: Array<{ name: string; data: ArrayBuffer }>;
  /** URL original → nombre del archivo empaquetado. Lo que no está, no se empaquetó. */
  byUrl: Map<string, string>;
  /** Cuántas quedaron fuera, por presupuesto o por fallo de descarga. */
  skipped: number;
}

/**
 * Empaqueta las URLs que pertenezcan a `storage`. Las ajenas se descartan sin
 * intentar descargarlas: el contenido del usuario puede apuntar a cualquier host y
 * el servidor no hace de proxy de URLs arbitrarias.
 */
export async function bundleImages(
  urls: string[],
  storage: ImageStorage,
  budget: Partial<BundleBudget> = {},
  now: () => number = Date.now,
): Promise<BundledImages> {
  const limits = { ...DEFAULT_BUNDLE_BUDGET, ...budget };
  const started = now();

  const owned = [...new Set(urls)].filter((url) => storage.owns(url));
  const result: BundledImages = { files: [], byUrl: new Map(), skipped: 0 };

  const usedNames = new Set<string>();
  let totalBytes = 0;
  let cursor = 0;

  const takeNext = (): string | null => {
    if (cursor >= owned.length) return null;
    if (result.files.length >= limits.maxImages) return null;
    if (totalBytes >= limits.maxTotalBytes) return null;
    if (now() - started >= limits.deadlineMs) return null;
    return owned[cursor++];
  };

  async function worker(): Promise<void> {
    for (let url = takeNext(); url !== null; url = takeNext()) {
      let downloaded: { data: ArrayBuffer } | null = null;
      try {
        downloaded = await storage.download(url);
      } catch {
        downloaded = null;
      }
      if (!downloaded) {
        result.skipped += 1;
        continue;
      }
      // El tope se comprueba también después de descargar: hasta aquí no se sabía
      // cuánto pesaba, y una imagen que lo revienta no debe entrar igualmente.
      if (totalBytes + downloaded.data.byteLength > limits.maxTotalBytes) {
        result.skipped += 1;
        continue;
      }
      totalBytes += downloaded.data.byteLength;
      const name = uniqueName(url, usedNames);
      result.files.push({ name, data: downloaded.data });
      result.byUrl.set(url, name);
    }
  }

  const workers = Math.max(1, Math.min(limits.concurrency, owned.length));
  await Promise.all(Array.from({ length: workers }, () => worker()));

  // Lo que nunca se llegó a intentar por presupuesto agotado también cuenta.
  result.skipped += owned.length - cursor;

  return result;
}

function uniqueName(url: string, used: Set<string>): string {
  const base = assetFileName(url);
  if (!used.has(base)) {
    used.add(base);
    return base;
  }
  const dot = base.lastIndexOf(".");
  const stem = dot > 0 ? base.slice(0, dot) : base;
  const ext = dot > 0 ? base.slice(dot) : "";
  for (let i = 2; ; i += 1) {
    const candidate = `${stem}-${i}${ext}`;
    if (!used.has(candidate)) {
      used.add(candidate);
      return candidate;
    }
  }
}
