import { randomUUID } from "node:crypto";
import { z } from "zod";
import { api } from "@convex/_generated/api";
import {
  appendInteraction,
  buildCheckpoint,
  readCheckpoint,
  renderSession,
  writeSession,
  type Checkpoint,
} from "../learning-session";
import { htmlToMarkdown, markdownToHtml } from "../markdown";
import type { Call, Tool } from "./define";

/**
 * Sesiones de aprendizaje reanudables.
 *
 * Son las únicas tools que no son una función de Convex con otro nombre, y
 * por eso viven aparte del catálogo: cada una es **una secuencia** sobre las
 * funciones que ya existen (leer la página, reescribir su markdown, guardarla).
 *
 * Lo que las justifica es que el agente, por su cuenta, tendría que acordarse
 * del formato del documento en cada llamada. Aquí el formato es código probado
 * (`learning-session.ts`) y el agente sólo decide qué enseñar.
 *
 * La versión la impone Convex, no estas tools: se le pasa el `expectedUpdatedAt`
 * que traía la última lectura del agente y es `pages.update` quien responde
 * CONFLICT si la página cambió. Comprobarlo aquí antes de escribir dejaría una
 * ventana entre la comprobación y el guardado, que es justo el problema.
 */

/** Lo que decide el agente en cada paso. El resto del checkpoint lo pone Kino. */
const checkpointInput = {
  currentNodeId: z.string().min(1).describe("Id estable del punto del material donde está el alumno"),
  lastUnderstood: z.string().describe("La última idea que el alumno demostró entender, con sus palabras si se puede"),
  openQuestion: z.string().nullable().optional().describe("La duda que quedó abierta, o null si no quedó ninguna"),
  nextAction: z.string().min(1).describe("Una sola acción concreta para retomar. Es lo primero que se lee al reanudar"),
  suggestedMinutes: z.number().int().min(1).max(90).describe("Cuánto debería durar el próximo bloque"),
};

const pageIdInput = z.string().min(1).describe("Id de la página donde vive la sesión");

const versionInput = z.iso
  .datetime({ offset: true })
  .describe(
    "El `updatedAt` que devolvió la última lectura o escritura de esta sesión. Si la página cambió desde entonces, la llamada falla con CONFLICT en vez de pisar lo que haya: vuelve a leerla y reintenta sobre lo nuevo",
  );

async function readSession(call: Call, pageId: string) {
  const page = await call("query", api.pages.byId, { id: pageId as never });
  const markdown = htmlToMarkdown(page.content);
  return { page, markdown, checkpoint: readCheckpoint(markdown) };
}

/** Guarda el documento entero. Devuelve la versión nueva para el siguiente paso. */
async function saveSession(call: Call, pageId: string, markdown: string, expectedUpdatedAt: string): Promise<string> {
  const saved = await call("mutation", api.pages.update, {
    id: pageId as never,
    content: markdownToHtml(markdown),
    expectedUpdatedAt,
  });
  return saved.updatedAt;
}

/** Lo que el agente necesita para seguir: dónde ibas y qué toca ahora. */
function resume(pageId: string, checkpoint: Checkpoint) {
  return {
    pageId,
    currentNodeId: checkpoint.currentNodeId,
    nextAction: checkpoint.nextAction,
    suggestedMinutes: checkpoint.suggestedMinutes,
    openQuestion: checkpoint.openQuestion,
  };
}

function sequence<S extends z.ZodRawShape>(spec: {
  name: string;
  description: string;
  input: z.ZodObject<S>;
  run: (call: Call, input: z.output<z.ZodObject<S>>) => Promise<unknown>;
}): Tool {
  return {
    name: spec.name,
    description: spec.description,
    input: spec.input,
    run: (call, raw) => spec.run(call, spec.input.parse(raw)),
  };
}

export const LEARNING_TOOLS: readonly Tool[] = [
  sequence({
    name: "create_learning_session",
    description:
      "Abre una sesión de aprendizaje reanudable en una página de Kino. La página queda escrita en markdown legible: qué toca ahora, por qué importa, qué sigue, el checkpoint para reanudar y un registro de lo que va pasando.",
    input: z.object({
      systemId: z.string().min(1).describe("Id del sistema de Kino donde vivirá la sesión"),
      folderId: z.string().min(1).optional().describe("Id de la carpeta, si la sesión pertenece a una"),
      topic: z.string().min(1).max(480).describe("Qué se está aprendiendo"),
      now: z.string().min(1).describe("Qué debe atender el alumno ahora mismo"),
      why: z.string().min(1).describe("Por qué este paso importa para lo que quiere conseguir"),
      ...checkpointInput,
    }),
    async run(call, { systemId, folderId, topic, now, why, ...draft }) {
      const checkpoint = buildCheckpoint(randomUUID(), draft, new Date());
      const markdown = renderSession({ topic, now, why, checkpoint });
      const page = await call("mutation", api.pages.create, {
        systemId: systemId as never,
        folderId: folderId as never,
        title: `Aprendizaje: ${topic}`,
        content: markdownToHtml(markdown),
      });
      return { pageId: page.id, updatedAt: page.updatedAt, checkpoint };
    },
  }),

  sequence({
    name: "get_learning_session",
    description:
      "Recupera una sesión de aprendizaje lista para reanudar: el documento en markdown y el checkpoint con dónde se quedó el alumno. Empieza siempre por aquí antes de seguir enseñando.",
    input: z.object({ pageId: pageIdInput }),
    async run(call, { pageId }) {
      const { page, markdown, checkpoint } = await readSession(call, pageId);
      return {
        pageId: page.id,
        title: page.title,
        // La versión que hay que devolver al guardar.
        updatedAt: page.updatedAt,
        contentFormat: "markdown",
        content: markdown,
        checkpoint,
        resume: resume(page.id, checkpoint),
      };
    },
  }),

  sequence({
    name: "save_learning_checkpoint",
    description:
      "Guarda dónde quedó la sesión: reescribe Ahora, Por qué, Después y el checkpoint. El registro de interacciones no se toca. Llámalo al terminar un paso, no en cada frase.",
    input: z.object({
      pageId: pageIdInput,
      expectedUpdatedAt: versionInput,
      now: z.string().min(1).describe("Qué debe atender el alumno a partir de ahora"),
      why: z.string().min(1).describe("Por qué ese paso importa"),
      ...checkpointInput,
    }),
    async run(call, { pageId, expectedUpdatedAt, now, why, ...draft }) {
      const { markdown, checkpoint: previous } = await readSession(call, pageId);
      // El id de sesión es de la sesión, no del paso: se conserva entre guardados.
      const checkpoint = buildCheckpoint(previous.sessionId, draft, new Date());
      const updatedAt = await saveSession(call, pageId, writeSession(markdown!, { now, why, checkpoint }), expectedUpdatedAt);
      return { pageId, updatedAt, checkpoint };
    },
  }),

  sequence({
    name: "append_learning_interaction",
    description:
      "Añade una interacción al registro de la sesión: una pregunta de sondeo, una explicación, una comprobación o una nota. Es la memoria de lo que ya se intentó, y sólo crece.",
    input: z.object({
      pageId: pageIdInput,
      expectedUpdatedAt: versionInput,
      kind: z.enum(["probe", "teach", "check", "note"]).describe("probe = sondear qué sabe, teach = explicar, check = comprobar, note = observación"),
      content: z.string().min(1).describe("Qué pasó, en markdown. La evidencia, no el resumen"),
      recordedAt: z.iso.datetime({ offset: true }).optional().describe("Cuándo ocurrió, si no fue ahora mismo"),
    }),
    async run(call, { pageId, expectedUpdatedAt, kind, content, recordedAt }) {
      const { markdown } = await readSession(call, pageId);
      const at = recordedAt ? new Date(recordedAt) : new Date();
      const updatedAt = await saveSession(call, pageId, appendInteraction(markdown!, { kind, content, at }), expectedUpdatedAt);
      return { pageId, updatedAt, recordedAt: at.toISOString() };
    },
  }),

  sequence({
    name: "park_learning_thought",
    description:
      "Aparca una idea o una distracción que salió a mitad de la sesión, como nota adhesiva en la página, y devuelve el punto exacto donde se estaba. Sirve para no perder lo que se le ocurrió al alumno ni el hilo de lo que estaba haciendo.",
    input: z.object({
      pageId: pageIdInput,
      thought: z.string().min(1).max(500).describe("La idea, tal como la dijo el alumno"),
      title: z.string().max(200).optional().describe("Título breve para encontrarla después"),
    }),
    async run(call, { pageId, thought, title }) {
      const { checkpoint } = await readSession(call, pageId);
      const note = await call("mutation", api.stickyNotes.createOnPage, {
        pageId: pageId as never,
        title: title ?? "Pensamiento aparcado",
        content: thought,
        color: "yellow",
      });
      // No se escribe en el documento a propósito: aparcar una idea no cambia
      // dónde está el alumno, y hacerlo movería la versión de la página por algo
      // que no es aprendizaje.
      return { note, resume: resume(pageId, checkpoint) };
    },
  }),
];
