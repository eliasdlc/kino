import type { ItemEvent } from "./item-events";

/**
 * Filas del log de muestra, compartidas por los tests de la lista y los de la
 * fila. Están aquí y no en cada test para que un campo nuevo en la respuesta de
 * `eventLog.porItem` rompa en un sitio y no en cinco.
 */

const hace = (ms: number) => new Date(Date.now() - ms).toISOString();

export const creadoPorElAgente: ItemEvent = {
  id: "eventLog:1" as ItemEvent["id"],
  action: "task.create",
  actor: { kind: "propio", channel: "oauth", name: "Elias" },
  occurredAt: hace(120_000),
  undoneAt: null,
  undoneFields: null,
  desdePropuesta: false,
  deshacer: { forma: "inverse" },
};

export const editadoPorOtra: ItemEvent = {
  id: "eventLog:2" as ItemEvent["id"],
  action: "task.update",
  actor: { kind: "redactado", channel: "session" },
  occurredAt: hace(3 * 3_600_000),
  undoneAt: null,
  undoneFields: null,
  desdePropuesta: false,
  deshacer: { forma: "no", motivo: "Ese cambio no es tuyo." },
};

export const tiempoApuntado: ItemEvent = {
  id: "eventLog:3" as ItemEvent["id"],
  action: "task.createTimeLog",
  actor: { kind: "propio", channel: "session", name: "Elias" },
  occurredAt: hace(600_000),
  undoneAt: null,
  undoneFields: null,
  desdePropuesta: false,
  deshacer: {
    forma: "no",
    motivo: "El tiempo trabajado es un hecho, no una edición: borrarlo sería borrar que trabajaste.",
  },
};
