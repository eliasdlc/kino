import { compressImageToWebp } from "@/features/uploads/image-compress";
import type { RegistroCompartido } from "./shareTarget";

/** Lo que hace falta para crear la captura en el servidor. */
export interface CapturaParaCrear {
  kind: RegistroCompartido["kind"];
  text?: string;
  url?: string;
  blobPath?: string;
  durationSeconds?: number;
}

/**
 * Por qué no se pudo subir. La diferencia importa: sin red la captura sale sola
 * cuando vuelva, y por cualquier otro motivo no sale nunca. Decir "sin red"
 * cuando el servidor rechazó el archivo es prometer algo que no va a pasar.
 */
export type MotivoDeFallo = "sin-red" | "demasiado-grande" | "tipo-no-soportado" | "otro";

export class FalloAlSubir extends Error {
  constructor(readonly motivo: MotivoDeFallo, mensaje: string) {
    super(mensaje);
    this.name = "FalloAlSubir";
  }
}

/** Lo que el mundo pone: comprimir y subir. Inyectados para poder probarlo. */
export interface HerramientasDeSubida {
  comprimir: (file: File, opciones?: { maxDim?: number }) => Promise<Blob>;
  subir: (blob: Blob, nombre: string | null) => Promise<string>;
}

/**
 * Las fotos se comprimen antes de subirlas.
 *
 * No es una optimización: `/api/uploads` corta en 4 MB porque nació para las
 * imágenes del editor, que el cliente ya comprime. Una foto de la cámara de un
 * teléfono pasa de 4 MB casi siempre, así que compartir una sin comprimir
 * devolvía 413 y la pantalla lo contaba como si fuera falta de red.
 */
export const LADO_MAXIMO = 1600;

/** Un audio no se puede comprimir aquí, así que su tope es el de la ruta. */
export const TOPE_BYTES = 4 * 1024 * 1024;

export async function prepararCaptura(
  registro: RegistroCompartido,
  { comprimir, subir }: HerramientasDeSubida,
): Promise<CapturaParaCrear> {
  const base: CapturaParaCrear = { kind: registro.kind };

  if (registro.kind === "link" && registro.url) return { ...base, url: registro.url };
  if (registro.kind === "text" && registro.text) return { ...base, text: registro.text };
  if (!registro.blob) return registro.text ? { ...base, text: registro.text } : base;

  const nombre = registro.name ?? "captura";
  let archivo: Blob = registro.blob;

  if (registro.kind === "photo") {
    try {
      archivo = await comprimir(new File([registro.blob], nombre, { type: registro.blob.type }), {
        maxDim: LADO_MAXIMO,
      });
    } catch {
      // Un formato que el navegador no sabe decodificar (HEIC en algunos
      // Android) llega sin comprimir y lo corta el tope de abajo, con su
      // motivo, en vez de fallar aquí con una traza que nadie lee.
      archivo = registro.blob;
    }
  }

  if (archivo.size > TOPE_BYTES) {
    throw new FalloAlSubir(
      "demasiado-grande",
      registro.kind === "voice"
        ? "La nota de voz pesa más de 4 MB y no se pudo guardar en Kino."
        : "La foto pesa más de 4 MB incluso comprimida y no se pudo guardar en Kino.",
    );
  }

  return { ...base, blobPath: await subir(archivo, nombre) };
}

/** Sube un archivo local y devuelve su URL pública. */
export async function subirArchivo(blob: Blob): Promise<string> {
  let respuesta: Response;
  try {
    respuesta = await fetch("/api/uploads", {
      method: "POST",
      headers: { "content-type": blob.type },
      body: blob,
    });
  } catch {
    throw new FalloAlSubir("sin-red", "No hay conexión ahora mismo.");
  }

  if (!respuesta.ok) {
    if (respuesta.status === 413) {
      throw new FalloAlSubir("demasiado-grande", "El archivo pesa más de lo que Kino admite.");
    }
    if (respuesta.status === 415) {
      throw new FalloAlSubir("tipo-no-soportado", "Kino todavía no sabe guardar este tipo de archivo.");
    }
    throw new FalloAlSubir("otro", `No se pudo guardar el archivo (${respuesta.status}).`);
  }

  const { url } = (await respuesta.json()) as { url: string };
  return url;
}

/** Las herramientas de verdad, las del navegador. */
export const HERRAMIENTAS: HerramientasDeSubida = {
  comprimir: compressImageToWebp,
  subir: subirArchivo,
};
