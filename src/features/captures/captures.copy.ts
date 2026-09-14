import type { CaptureItem } from "./captures.types";

/** Lo que se lee de una captura en una fila. Nunca un nombre inventado. */
export function tituloDe(captura: CaptureItem): string {
  if (captura.url) return captura.url;
  if (captura.text) return captura.text;
  if (captura.kind === "voice") return "Nota de voz";
  return "Foto";
}

/**
 * Lo que la fila dice de su estado, o nada cuando no hay nada que decir.
 *
 * El aviso va antes de caducar y lo caducado lo dice después: las dos mitades
 * de que nada se archive en silencio caben en esta línea.
 */
export function estadoDe(captura: CaptureItem): string | null {
  if (captura.status === "expired") return "Caducó sin confirmar";
  if (!captura.avisa) return null;
  const dias = captura.diasRestantes;
  return dias === 1 ? "Caduca mañana" : `Caduca en ${dias} días`;
}

/** Cuántas esperan confirmación, en la línea del encabezado de Bandeja. */
export function resumenSinConfirmar(cuantas: number): string | null {
  if (cuantas === 0) return null;
  return cuantas === 1 ? "1 captura sin confirmar" : `${cuantas} capturas sin confirmar`;
}
