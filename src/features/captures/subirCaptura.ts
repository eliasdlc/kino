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
 * Sube el archivo de un registro, si lo tiene, y devuelve los argumentos de la
 * mutación. Separado del componente porque es la parte que se puede probar sin
 * montar nada: lo demás es esperar a que haya red.
 */
export async function prepararCaptura(
  registro: RegistroCompartido,
  subir: (blob: Blob) => Promise<string>,
): Promise<CapturaParaCrear> {
  const base: CapturaParaCrear = { kind: registro.kind };

  if (registro.kind === "link" && registro.url) return { ...base, url: registro.url };
  if (registro.kind === "text" && registro.text) return { ...base, text: registro.text };
  if (!registro.blob) return registro.text ? { ...base, text: registro.text } : base;

  return { ...base, blobPath: await subir(registro.blob) };
}

/** Sube un archivo local y devuelve su URL pública. */
export async function subirArchivo(blob: Blob): Promise<string> {
  const respuesta = await fetch("/api/uploads", {
    method: "POST",
    headers: { "content-type": blob.type },
    body: blob,
  });
  if (!respuesta.ok) throw new Error(`No se pudo subir el archivo (${respuesta.status})`);
  const { url } = (await respuesta.json()) as { url: string };
  return url;
}
