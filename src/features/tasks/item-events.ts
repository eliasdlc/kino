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
 * Qué hizo cada acción, en las dos formas en que el producto la lee.
 *
 * `item` es la frase de la lista de un item, en pasado y sin sujeto (lo pone
 * `sujetoDe`). `verbo`, `clase` y `resumen` son la fila diaria de Hoy, donde lo que
 * importa es la cifra y por eso va delante: «creó 4 tareas», no «creó tareas
 * (4)». Las dos formas viven en la misma entrada para que no puedan
 * describir cosas distintas, que es lo que pasa con dos tablas paralelas.
 *
 * `clase` está aparte del resumen a propósito: es lo que permite ver que dos
 * tramos seguidos hablan de lo mismo, y «tarea» y «tareas» no se parecen lo
 * suficiente para deducirlo del texto ya declinado.
 */
export const FRASES: Record<string, { item: string; verbo: string; clase: string; resumen: (n: number) => string }> = {
  "task.create": { item: "creó esta tarea", clase: "tarea", resumen: (n) => `${n} ${n === 1 ? "tarea" : "tareas"}`, verbo: "creó" },
  "task.update": { item: "editó esta tarea", clase: "tarea", resumen: (n) => `${n} ${n === 1 ? "tarea" : "tareas"}`, verbo: "editó" },
  "task.remove": { item: "la mandó a la papelera", clase: "tarea", resumen: (n) => `${n} ${n === 1 ? "tarea" : "tareas"}`, verbo: "mandó a la papelera" },
  "task.restore": { item: "la sacó de la papelera", clase: "tarea", resumen: (n) => `${n} ${n === 1 ? "tarea" : "tareas"}`, verbo: "sacó de la papelera" },
  "task.toggle": { item: "cambió si está hecha", clase: "tarea", resumen: (n) => `${n} ${n === 1 ? "tarea" : "tareas"}`, verbo: "marcó" },
  "task.move": { item: "la movió de estado", clase: "tarea", resumen: (n) => `${n} ${n === 1 ? "tarea" : "tareas"}`, verbo: "movió" },
  "task.moveBoard": { item: "la movió de columna", clase: "tarea", resumen: (n) => `${n} ${n === 1 ? "tarea" : "tareas"}`, verbo: "cambió de columna" },
  "task.createTimeLog": { item: "apuntó tiempo trabajado", clase: "tarea", resumen: (n) => `${n} ${n === 1 ? "tarea" : "tareas"}`, verbo: "apuntó tiempo en" },

  "page.create": { item: "creó este capítulo", clase: "capítulo", resumen: (n) => `${n} ${n === 1 ? "capítulo" : "capítulos"}`, verbo: "creó" },
  "page.update": { item: "editó este capítulo", clase: "capítulo", resumen: (n) => `${n} ${n === 1 ? "capítulo" : "capítulos"}`, verbo: "editó" },
  "page.remove": { item: "lo mandó a la papelera", clase: "capítulo", resumen: (n) => `${n} ${n === 1 ? "capítulo" : "capítulos"}`, verbo: "mandó a la papelera" },
  "page.restore": { item: "lo sacó de la papelera", clase: "capítulo", resumen: (n) => `${n} ${n === 1 ? "capítulo" : "capítulos"}`, verbo: "sacó de la papelera" },
  "page.linkTask": { item: "le enlazó una tarea", clase: "capítulo", resumen: (n) => `${n} ${n === 1 ? "capítulo" : "capítulos"}`, verbo: "enlazó una tarea a" },
  "page.unlinkTask": { item: "le quitó una tarea", clase: "capítulo", resumen: (n) => `${n} ${n === 1 ? "capítulo" : "capítulos"}`, verbo: "quitó una tarea de" },
  "page.addTag": { item: "le puso una etiqueta", clase: "capítulo", resumen: (n) => `${n} ${n === 1 ? "capítulo" : "capítulos"}`, verbo: "etiquetó" },
  "page.removeTag": { item: "le quitó una etiqueta", clase: "capítulo", resumen: (n) => `${n} ${n === 1 ? "capítulo" : "capítulos"}`, verbo: "desetiquetó" },

  "folder.create": { item: "creó esta carpeta", clase: "carpeta", resumen: (n) => `${n} ${n === 1 ? "carpeta" : "carpetas"}`, verbo: "creó" },
  "folder.update": { item: "editó esta carpeta", clase: "carpeta", resumen: (n) => `${n} ${n === 1 ? "carpeta" : "carpetas"}`, verbo: "editó" },
  "folder.remove": { item: "la mandó a la papelera", clase: "carpeta", resumen: (n) => `${n} ${n === 1 ? "carpeta" : "carpetas"}`, verbo: "mandó a la papelera" },
  "folder.restore": { item: "la sacó de la papelera", clase: "carpeta", resumen: (n) => `${n} ${n === 1 ? "carpeta" : "carpetas"}`, verbo: "sacó de la papelera" },

  "stickyNote.create": { item: "escribió esta nota", clase: "nota", resumen: (n) => `${n} ${n === 1 ? "nota" : "notas"}`, verbo: "escribió" },
  "stickyNote.update": { item: "editó esta nota", clase: "nota", resumen: (n) => `${n} ${n === 1 ? "nota" : "notas"}`, verbo: "editó" },
  "stickyNote.remove": { item: "la mandó a la papelera", clase: "nota", resumen: (n) => `${n} ${n === 1 ? "nota" : "notas"}`, verbo: "mandó a la papelera" },
  "stickyNote.restore": { item: "la sacó de la papelera", clase: "nota", resumen: (n) => `${n} ${n === 1 ? "nota" : "notas"}`, verbo: "sacó de la papelera" },
  "stickyNote.stack": { item: "la apiló sobre otra", clase: "nota", resumen: (n) => `${n} ${n === 1 ? "nota" : "notas"}`, verbo: "apiló" },

  "system.create": { item: "creó este sistema", clase: "sistema", resumen: (n) => `${n} ${n === 1 ? "sistema" : "sistemas"}`, verbo: "creó" },
  "system.update": { item: "editó este sistema", clase: "sistema", resumen: (n) => `${n} ${n === 1 ? "sistema" : "sistemas"}`, verbo: "editó" },
  "system.remove": { item: "lo archivó", clase: "sistema", resumen: (n) => `${n} ${n === 1 ? "sistema" : "sistemas"}`, verbo: "archivó" },

  "tag.remove": { item: "borró esta etiqueta", clase: "etiqueta", resumen: (n) => `${n} ${n === 1 ? "etiqueta" : "etiquetas"}`, verbo: "borró" },

  "energy.applyWeeklyRitual": { item: "repartió lo vencido en el ritual semanal", clase: "vencida en el ritual", resumen: (n) => `${n} ${n === 1 ? "vencida en el ritual" : "vencidas en el ritual"}`, verbo: "repartió" },
  "energy.applyCeiling": { item: "cambió tu techo del día", clase: "vez tu techo del día", resumen: (n) => `${n} ${n === 1 ? "vez tu techo del día" : "veces tu techo del día"}`, verbo: "cambió" },
  "energy.updateProfile": { item: "cambió tu perfil de energía", clase: "vez tu perfil de energía", resumen: (n) => `${n} ${n === 1 ? "vez tu perfil de energía" : "veces tu perfil de energía"}`, verbo: "cambió" },

  "log.deshacer": { item: "deshizo un cambio de aquí", clase: "cambio", resumen: (n) => `${n} ${n === 1 ? "cambio" : "cambios"}`, verbo: "deshizo" },
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
