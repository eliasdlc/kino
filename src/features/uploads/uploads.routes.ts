import { NextResponse } from "next/server";
import { route } from "@/shared/utils/route";
import { getImageStorage, userKeyPrefix } from "./image-storage";

const MAX_BYTES = 4 * 1024 * 1024; // 4MB: tras compresión WebP client-side sobra.
const EXT_BY_TYPE: Record<string, string> = {
  "image/webp": "webp",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/avif": "avif",
  // Audio desde la hoja de compartir. Una nota de voz de varios minutos cabe de
  // sobra en los 4MB: los formatos que graban los teléfonos rondan 1MB/minuto.
  "audio/mp4": "m4a",
  "audio/mpeg": "mp3",
  "audio/ogg": "ogg",
  "audio/webm": "weba",
  "audio/aac": "aac",
};

/**
 * POST /api/uploads: sube una imagen o una nota de voz y devuelve su URL
 * pública. El cuerpo es el archivo crudo; el content-type declara el formato.
 * Las imágenes llegan ya comprimidas desde el cliente; el audio llega tal cual
 * lo grabó el teléfono, que es lo que la hoja de compartir manda.
 */
export const uploadImage = route()({}, async ({ userId, request }) => {
  const storage = getImageStorage();
  if (!storage) {
    return NextResponse.json(
      { code: "STORAGE_UNAVAILABLE", message: "El almacenamiento de imágenes no está configurado" },
      { status: 503 },
    );
  }

  const contentType = (request.headers.get("content-type") ?? "").split(";")[0].trim();
  const ext = EXT_BY_TYPE[contentType];
  if (!ext) {
    return NextResponse.json(
      { code: "UNSUPPORTED_TYPE", message: "Tipo de archivo no soportado" },
      { status: 415 },
    );
  }

  const buffer = await request.arrayBuffer();
  if (buffer.byteLength === 0) {
    return NextResponse.json({ code: "EMPTY", message: "Cuerpo vacío" }, { status: 400 });
  }
  if (buffer.byteLength > MAX_BYTES) {
    return NextResponse.json(
      { code: "TOO_LARGE", message: "El archivo supera el límite de 4MB" },
      { status: 413 },
    );
  }

  try {
    const { url } = await storage.upload({
      data: buffer,
      contentType,
      keyPrefix: userKeyPrefix(userId),
      ext,
    });
    return NextResponse.json({ url }, { status: 201 });
  } catch {
    return NextResponse.json(
      { code: "UPLOAD_FAILED", message: "No se pudo subir la imagen" },
      { status: 502 },
    );
  }
});
