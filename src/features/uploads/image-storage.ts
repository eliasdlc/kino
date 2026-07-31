import { put, del } from "@vercel/blob";

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
