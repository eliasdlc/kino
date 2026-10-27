import { format, isToday, isYesterday } from "date-fns";
import { es } from "date-fns/locale";
import type { CaptureItem } from "./captures.types";

/** Lo que se lee de una captura en una fila. Nunca un nombre inventado. */
export function tituloDe(captura: CaptureItem): string {
  if (captura.url) return captura.url;
  if (captura.text) return captura.text;
  if (captura.kind === "voice") return "Nota de voz";
  if (captura.kind === "email") return "Correo";
  if (captura.kind === "file") return "Archivo";
  return "Foto";
}

/**
 * El estado de una captura en una palabra, que es lo primero de su meta: si
 * nadie la ha leído, cuántas tareas propone o que caducó. Una captura recién
 * llegada no puede quedarse muda: es la que más pide que la toquen.
 */
export function estadoDe(captura: CaptureItem): string {
  if (captura.status === "expired") return "caducó sin confirmar";
  const propuestas = captura.proposedItems?.length ?? 0;
  if (propuestas === 0) return "sin leer";
  return propuestas === 1 ? "1 tarea propuesta" : `${propuestas} tareas propuestas`;
}

/**
 * El aviso de caducidad, o nada cuando todavía no toca. El aviso va antes de
 * caducar y lo caducado lo dice el estado: las dos mitades de que nada se
 * archive en silencio.
 */
export function avisoDe(captura: CaptureItem): string | null {
  if (captura.status === "expired" || !captura.avisa) return null;
  const dias = captura.diasRestantes;
  return dias === 1 ? "caduca mañana" : `caduca en ${dias} días`;
}

/** Cuándo llegó: "hoy 10:24", "ayer 18:02" o "12 oct". */
export function cuandoLlego(captura: CaptureItem): string {
  const fecha = new Date(captura.createdAt);
  if (isToday(fecha)) return `hoy ${format(fecha, "HH:mm")}`;
  if (isYesterday(fecha)) return `ayer ${format(fecha, "HH:mm")}`;
  return format(fecha, "d MMM", { locale: es }).replace(".", "");
}
