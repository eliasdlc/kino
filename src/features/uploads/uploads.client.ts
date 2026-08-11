import { compressImageToWebp } from "./image-compress";

/**
 * Comprime a WebP y sube una imagen; devuelve su URL pública. Lanza con un mensaje
 * legible si el almacenamiento no está configurado (503) o falla la subida.
 */
export async function uploadImageFile(file: File): Promise<string> {
  const blob = await compressImageToWebp(file);
  const res = await fetch("/api/uploads", {
    method: "POST",
    headers: { "content-type": "image/webp" },
    body: blob,
  });
  if (res.status === 503) {
    throw new Error("El almacenamiento de imágenes aún no está configurado");
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { message?: string }).message ?? "No se pudo subir la imagen");
  }
  const { url } = (await res.json()) as { url: string };
  return url;
}
