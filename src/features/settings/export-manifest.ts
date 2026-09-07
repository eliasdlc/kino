import type { TableNames } from "@convex/_generated/dataModel";

/**
 * Qué se lleva el export y qué no, tabla por tabla.
 *
 * Existe porque la pantalla prometía «workspace completo» mientras el ZIP se
 * llevaba cuatro tablas: una promesa escrita en el sitio donde alguien decide
 * si confía en poder irse. La lista es una sola y la leen los dos lados, la
 * consulta que arma el ZIP y la tabla que la pantalla enseña, así que «completo»
 * se puede comprobar en vez de creer. `convex/export.test.ts` falla si el schema
 * gana una tabla que no está aquí.
 */

export type ExportFormat = "JSON" | "JSON + Markdown";

export interface ExportTable {
  readonly tabla: TableNames;
  readonly etiqueta: string;
  /** En qué formato viaja, o `null` si no viaja. */
  readonly formato: ExportFormat | null;
  /** Por qué no viaja. Sólo cuando `formato` es null. */
  readonly motivo?: string;
}

export const EXPORT_TABLES: readonly ExportTable[] = [
  { tabla: "users", etiqueta: "Tu cuenta", formato: "JSON" },
  { tabla: "userSettings", etiqueta: "Ajustes", formato: "JSON" },
  { tabla: "systems", etiqueta: "Sistemas", formato: "JSON" },
  { tabla: "tasks", etiqueta: "Tareas", formato: "JSON" },
  { tabla: "sprints", etiqueta: "Ciclos", formato: "JSON" },
  { tabla: "contextTags", etiqueta: "Etiquetas", formato: "JSON" },
  { tabla: "systemStatusDefinitions", etiqueta: "Columnas de tablero", formato: "JSON" },
  { tabla: "taskReminders", etiqueta: "Recordatorios", formato: "JSON" },
  { tabla: "folders", etiqueta: "Carpetas", formato: "JSON" },
  { tabla: "pages", etiqueta: "Cuadernos y capítulos", formato: "JSON + Markdown" },
  { tabla: "stickyNotes", etiqueta: "Notas adhesivas", formato: "JSON" },
  { tabla: "pageSnapshots", etiqueta: "Versiones de capítulo", formato: "JSON" },
  { tabla: "entities", etiqueta: "Entidades del codex", formato: "JSON" },
  { tabla: "entityRelations", etiqueta: "Relaciones entre entidades", formato: "JSON" },
  { tabla: "taskPageLinks", etiqueta: "Tareas enlazadas a capítulos", formato: "JSON" },
  { tabla: "pageTags", etiqueta: "Etiquetas de capítulo", formato: "JSON" },
  { tabla: "pageEntityMentions", etiqueta: "Menciones del codex", formato: "JSON" },
  { tabla: "userEnergyProfile", etiqueta: "Tu perfil de energía", formato: "JSON" },
  { tabla: "energyCheckins", etiqueta: "Registros de energía", formato: "JSON" },
  { tabla: "energyPredictions", etiqueta: "Predicciones de energía", formato: "JSON" },
  { tabla: "behaviorSnapshots", etiqueta: "Fotos diarias de actividad", formato: "JSON" },
  { tabla: "timeLogs", etiqueta: "Tiempo registrado", formato: "JSON" },

  { tabla: "userBilling", etiqueta: "Facturación", formato: null, motivo: "Sin código de pagos: la tabla está vacía." },
  { tabla: "usageCounters", etiqueta: "Contadores de uso", formato: null, motivo: "Cuentas de infraestructura, no contenido tuyo." },
  { tabla: "syncConnections", etiqueta: "Conexiones con GitHub", formato: null, motivo: "Guarda credenciales cifradas; fuera de Kino no sirven." },
  { tabla: "pushSubscriptions", etiqueta: "Avisos push", formato: null, motivo: "Claves del navegador, atadas a este dispositivo." },
  { tabla: "cronRuns", etiqueta: "Bitácora de los crons", formato: null, motivo: "Rastro de la máquina." },
  { tabla: "rateLimits", etiqueta: "Límites de uso", formato: null, motivo: "Rastro de la máquina." },
  { tabla: "eventLog", etiqueta: "Registro de eventos", formato: null, motivo: "Se poda a los 30 días." },
  { tabla: "itemLinks", etiqueta: "Enlaces entre elementos", formato: null, motivo: "Se poda a los 30 días." },
  { tabla: "systemMembers", etiqueta: "Miembros de un sistema", formato: null, motivo: "Compartir sistemas todavía no es producto." },
  { tabla: "systemInvites", etiqueta: "Invitaciones", formato: null, motivo: "Compartir sistemas todavía no es producto." },
  { tabla: "sessionDigests", etiqueta: "Diario de sesiones", formato: null, motivo: "El material crudo vive en tu laptop." },
  { tabla: "proposals", etiqueta: "Propuestas del agente", formato: null, motivo: "Caducan a los 14 días." },
  { tabla: "interruptions", etiqueta: "Interrupciones mostradas", formato: null, motivo: "Rastro de qué te preguntó Kino." },
  { tabla: "captures", etiqueta: "Capturas sin confirmar", formato: null, motivo: "Caducan a las 48 horas." },
];

/** Las tablas que sí viajan, en el orden en que se escriben. */
export const EXPORTED_TABLES = EXPORT_TABLES.filter((t) => t.formato !== null);

/** Carpeta del ZIP donde va un JSON por tabla, tal cual, para reimportar. */
export const DATA_DIR = "datos";
