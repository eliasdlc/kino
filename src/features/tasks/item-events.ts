import type { api } from "@convex/_generated/api";
import type { FunctionArgs, FunctionReturnType } from "convex/server";

/**
 * Cómo se lee una fila del log en pantalla.
 *
 * Dos piezas separadas a propósito: **el sujeto sale del actor** y el verbo
 * sale de la acción. Así la frase siempre empieza por quién, que es lo que la
 * lista existe para contestar, y ninguna acción nueva puede colarse sin frase:
 * `item-events.test.ts` recorre las acciones que `convex/` escribe de verdad y
 * falla si alguna no está aquí.
 */

export type ItemEvent = FunctionReturnType<typeof api.eventLog.porItem>["items"][number];

/** Las ocho clases de item que el log señala, tal como las declara la query. */
export type ItemType = FunctionArgs<typeof api.eventLog.porItem>["targetType"];

/**
 * Quién, con el nombre sólo cuando el actor es quien lee. La variante redactada
 * no trae nombre, así que aquí no hay nada que ocultar: el tipo ya lo hizo.
 */
export function sujetoDe(actor: ItemEvent["actor"]): string {
  if (actor.kind === "propio") {
    return actor.channel === "oauth" ? "Tu agente" : "Tú";
  }
  switch (actor.channel) {
    case "oauth":
      return "El agente de otra persona";
    case "session":
      return "Otra persona";
    case "sync":
      return "La sincronización con GitHub";
    case "system":
      return "La repetición automática";
  }
}

/**
 * Qué hizo. En pasado y sin el sujeto, que lo pone `sujetoDe`. Las ediciones no
 * enumeran campos: eso es del deshacer, que es quien tiene que ser preciso.
 */
export const VERBOS: Record<string, string> = {
  "task.create": "creó esta tarea",
  "task.update": "editó esta tarea",
  "task.remove": "la mandó a la papelera",
  "task.restore": "la sacó de la papelera",
  "task.toggle": "cambió si está hecha",
  "task.move": "la movió de estado",
  "task.moveBoard": "la movió de columna",
  "task.createTimeLog": "apuntó tiempo trabajado",

  "page.create": "creó este capítulo",
  "page.update": "editó este capítulo",
  "page.remove": "lo mandó a la papelera",
  "page.restore": "lo sacó de la papelera",
  "page.linkTask": "le enlazó una tarea",
  "page.unlinkTask": "le quitó una tarea",
  "page.addTag": "le puso una etiqueta",
  "page.removeTag": "le quitó una etiqueta",

  "folder.create": "creó esta carpeta",
  "folder.update": "editó esta carpeta",
  "folder.remove": "la mandó a la papelera",
  "folder.restore": "la sacó de la papelera",

  "stickyNote.create": "escribió esta nota",
  "stickyNote.update": "editó esta nota",
  "stickyNote.remove": "la mandó a la papelera",
  "stickyNote.restore": "la sacó de la papelera",
  "stickyNote.stack": "la apiló sobre otra",

  "system.create": "creó este sistema",
  "system.update": "editó este sistema",
  "system.remove": "lo archivó",

  "tag.remove": "borró esta etiqueta",

  "energy.applyWeeklyRitual": "repartió lo vencido en el ritual semanal",
  "energy.applyCeiling": "cambió tu techo del día",
};

const RELATIVO = new Intl.RelativeTimeFormat("es-DO", { numeric: "auto" });
const FECHA = new Intl.DateTimeFormat("es-DO", { dateStyle: "long" });

const ESCALA = [
  { limite: 60_000, unidad: "second" as const, ms: 1_000 },
  { limite: 3_600_000, unidad: "minute" as const, ms: 60_000 },
  { limite: 86_400_000, unidad: "hour" as const, ms: 3_600_000 },
  { limite: 7 * 86_400_000, unidad: "day" as const, ms: 86_400_000 },
];

/**
 * Cuándo. Relativo mientras la memoria alcanza, y la fecha entera a partir de
 * la semana: "hace 9 días" obliga a hacer la resta, y una fecha no.
 */
export function cuandoDe(iso: string, ahora = Date.now()): string {
  const hueco = ahora - Date.parse(iso);
  const escala = ESCALA.find((paso) => hueco < paso.limite);
  if (!escala) return FECHA.format(new Date(iso));
  return RELATIVO.format(-Math.round(hueco / escala.ms), escala.unidad);
}
