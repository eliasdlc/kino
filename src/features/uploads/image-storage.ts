import { put, del, list } from "@vercel/blob";

/**
 * Prefijo de todas las imágenes de un usuario dentro del store.
 *
 * Vive aquí y no en el llamador porque lo comparten dos operaciones opuestas: la
 * subida escribe bajo este prefijo y el barrido de huérfanas lista por él. Si los
 * dos dejaran de coincidir, el barrido no vería nada del usuario — o, peor, vería
 * lo de otro.
 */
export function userKeyPrefix(userId: string): string {
  return `u/${userId}`;
}

/**
 * Abstracción de almacenamiento de imágenes (Writing W2, §5.3). El resto de la app
 * habla con esta interfaz, nunca con Vercel Blob directamente: migrar a Cloudflare
 * R2 (10GB gratis, egress $0, S3-compatible) es cambiar el adapter, no una feature.
 */
export interface ImageStorage {
  upload(input: {
    data: ArrayBuffer | Buffer;
    contentType: string;
    /** Prefijo de ruta para aislar por usuario (p. ej. `u/<userId>`). */
    keyPrefix: string;
    /** Extensión sin punto (webp, png…). */
    ext: string;
  }): Promise<{ url: string }>;
  delete(url: string): Promise<void>;
  /**
   * ¿Esta URL la sirve este store? Distinguir lo propio de lo ajeno es lo que
   * permite descargar sin exponerse a SSRF: el contenido del usuario puede
   * apuntar a cualquier host, y el servidor solo debe traerse lo suyo.
   */
  owns(url: string): boolean;
  /** Descarga un blob propio. `null` si no existe o no responde. */
  download(url: string): Promise<{ data: ArrayBuffer; contentType: string } | null>;
  /**
   * Lista una página de blobs bajo un prefijo. `cursor` ausente en la respuesta
   * significa que no queda nada más.
   */
  list(input: { prefix: string; cursor?: string }): Promise<{
    blobs: StoredBlob[];
    cursor?: string;
  }>;
  /** Borra varios blobs de una vez. */
  deleteMany(urls: string[]): Promise<void>;
}

export interface StoredBlob {
  url: string;
  size: number;
  uploadedAt: Date;
}

/**
 * ¿La URL apunta a un store de Vercel Blob? Es la barrera que impide que el
 * servidor se descargue una URL cualquiera del contenido del usuario (SSRF), así
 * que se compara el sufijo **con el punto delante**: sin él, un host del estilo
 * `evilblob.vercel-storage.com` pasaría el filtro.
 */
export function isVercelBlobUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    // Los stores sirven desde `<storeId>.public.blob.vercel-storage.com`.
    return parsed.hostname.toLowerCase().endsWith(".blob.vercel-storage.com");
  } catch {
    return false;
  }
}

class VercelBlobStorage implements ImageStorage {
  constructor(private token: string) {}

  async upload(input: {
    data: ArrayBuffer | Buffer;
    contentType: string;
    keyPrefix: string;
    ext: string;
  }): Promise<{ url: string }> {
    const pathname = `${input.keyPrefix}/${crypto.randomUUID()}.${input.ext}`;
    const blob = await put(pathname, input.data, {
      access: "public",
      contentType: input.contentType,
      token: this.token,
      addRandomSuffix: false,
    });
    return { url: blob.url };
  }

  async delete(url: string): Promise<void> {
    await del(url, { token: this.token });
  }

  owns(url: string): boolean {
    return isVercelBlobUrl(url);
  }

  async list(input: { prefix: string; cursor?: string }): Promise<{
    blobs: StoredBlob[];
    cursor?: string;
  }> {
    const page = await list({
      prefix: input.prefix,
      cursor: input.cursor,
      token: this.token,
    });
    return {
      blobs: page.blobs.map((b) => ({
        url: b.url,
        size: b.size,
        uploadedAt: new Date(b.uploadedAt),
      })),
      cursor: page.hasMore ? page.cursor : undefined,
    };
  }

  async deleteMany(urls: string[]): Promise<void> {
    if (urls.length === 0) return;
    await del(urls, { token: this.token });
  }

  async download(url: string): Promise<{ data: ArrayBuffer; contentType: string } | null> {
    if (!this.owns(url)) return null;
    const res = await fetch(url);
    if (!res.ok) return null;
    return {
      data: await res.arrayBuffer(),
      contentType: res.headers.get("content-type") ?? "application/octet-stream",
    };
  }
}

/**
 * Devuelve el storage activo, o `null` si no hay backend configurado (falta
 * `BLOB_READ_WRITE_TOKEN`). Los llamadores degradan con gracia: sin storage, la
 * subida responde 503 y la UI recae en imágenes por URL. Provisionar el store de
 * Blob y setear el token es un paso de infraestructura del owner.
 */
export function getImageStorage(): ImageStorage | null {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return null;
  return new VercelBlobStorage(token);
}
