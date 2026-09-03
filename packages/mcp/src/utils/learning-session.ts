import { z } from 'zod';

/**
 * Una sesión de aprendizaje vive dentro de una página normal de Kino, escrita en
 * markdown. No hay tabla nueva, ni arquetipo nuevo, ni columna que migrar: lo
 * que el agente necesita para reanudar cabe en un documento que además una
 * persona puede abrir en el editor, leer y corregir a mano.
 *
 * El precio de esa decisión es que el formato **es** el schema, y por eso vive
 * aquí en funciones puras y probadas en vez de repartido por las tools: parsear
 * mal el checkpoint significaría perder el hilo de alguien.
 *
 * El documento tiene siempre esta forma:
 *
 *     # Tema
 *     > Sesión de aprendizaje de Kino · v1 · <id>
 *     ## Ahora        qué toca atender
 *     ## Por qué      por qué importa este paso
 *     ## Después      la siguiente acción, una sola
 *     ## Checkpoint   el estado en JSON, que es lo que se reanuda
 *     ## Registro     lo que fue pasando, y crece por abajo
 *
 * Las cuatro primeras se reescriben enteras en cada guardado. El registro sólo
 * recibe líneas nuevas: es la memoria de la sesión y nada lo reescribe.
 */

export const checkpointSchema = z.object({
  /** Sube cuando el formato deje de ser compatible; hoy no hay otra versión. */
  schemaVersion: z.literal(1),
  sessionId: z.uuid(),
  /** Dónde está el alumno dentro del material, con el id que use el agente. */
  currentNodeId: z.string().min(1),
  lastUnderstood: z.string(),
  openQuestion: z.string().nullable(),
  /** Una sola, y accionable: es lo primero que se lee al reanudar. */
  nextAction: z.string().min(1),
  suggestedMinutes: z.number().int().min(1).max(90),
  learnerStateUpdatedAt: z.iso.datetime({ offset: true }),
});

export type Checkpoint = z.infer<typeof checkpointSchema>;

/** Lo que el agente decide en cada paso; el resto del checkpoint lo pone Kino. */
export type CheckpointDraft = Omit<
  Checkpoint,
  'schemaVersion' | 'sessionId' | 'learnerStateUpdatedAt' | 'openQuestion'
> & { openQuestion?: string | null };

const NOW = 'Ahora';
const WHY = 'Por qué';
const NEXT = 'Después';
const CHECKPOINT = 'Checkpoint';
const LOG = 'Registro';

const JSON_BLOCK = /```json\s*\n([\s\S]*?)\n```/;

/** El checkpoint tal como se escribe dentro del documento. */
function checkpointBlock(checkpoint: Checkpoint): string {
  return ['```json', JSON.stringify(checkpoint, null, 2), '```'].join('\n');
}

export function buildCheckpoint(
  sessionId: string,
  draft: CheckpointDraft,
  at: Date,
): Checkpoint {
  return {
    schemaVersion: 1,
    sessionId,
    currentNodeId: draft.currentNodeId,
    lastUnderstood: draft.lastUnderstood,
    openQuestion: draft.openQuestion ?? null,
    nextAction: draft.nextAction,
    suggestedMinutes: draft.suggestedMinutes,
    learnerStateUpdatedAt: at.toISOString(),
  };
}

export function renderSession(input: {
  topic: string;
  now: string;
  why: string;
  checkpoint: Checkpoint;
}): string {
  return [
    `# ${input.topic.trim()}`,
    '',
    `> Sesión de aprendizaje de Kino · v1 · ${input.checkpoint.sessionId}`,
    '',
    `## ${NOW}`,
    '',
    input.now.trim(),
    '',
    `## ${WHY}`,
    '',
    input.why.trim(),
    '',
    `## ${NEXT}`,
    '',
    input.checkpoint.nextAction.trim(),
    '',
    `## ${CHECKPOINT}`,
    '',
    checkpointBlock(input.checkpoint),
    '',
    `## ${LOG}`,
    '',
  ].join('\n');
}

/**
 * Dónde empieza y dónde acaba una sección, por líneas y no por una expresión
 * regular sobre todo el documento: el checkpoint es un bloque de código con
 * llaves y comillas dentro, y una regex golosa se lo come.
 */
function sectionBounds(lines: string[], heading: string): { start: number; end: number } {
  const start = lines.findIndex((line) => line.trim() === `## ${heading}`);
  if (start === -1) {
    throw new Error(
      `Esta página no es una sesión de aprendizaje de Kino: le falta la sección "${heading}".`,
    );
  }

  let end = start + 1;
  while (end < lines.length && !lines[end]!.startsWith('## ')) end += 1;
  return { start, end };
}

function replaceSection(markdown: string, heading: string, body: string): string {
  const lines = markdown.split('\n');
  const { start, end } = sectionBounds(lines, heading);
  return [
    ...lines.slice(0, start),
    `## ${heading}`,
    '',
    body.trim(),
    '',
    ...lines.slice(end),
  ].join('\n');
}

/** Devuelve el checkpoint guardado, o explica por qué la página no sirve. */
export function readCheckpoint(markdown: string | null): Checkpoint {
  if (!markdown?.trim()) {
    throw new Error('Esta página está vacía: no hay ninguna sesión de aprendizaje que reanudar.');
  }

  const lines = markdown.split('\n');
  const { start, end } = sectionBounds(lines, CHECKPOINT);
  const block = lines.slice(start, end).join('\n').match(JSON_BLOCK);
  if (!block?.[1]) {
    throw new Error('La sección "Checkpoint" no tiene su bloque JSON: la sesión no se puede reanudar.');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(block[1]);
  } catch {
    throw new Error('El checkpoint de la sesión no es JSON válido. Ábrela en Kino y arréglalo a mano.');
  }

  const result = checkpointSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(
      `El checkpoint de la sesión no tiene la forma esperada: ${result.error.issues
        .map((issue) => `${issue.path.join('.') || 'raíz'} ${issue.message}`)
        .join('; ')}`,
    );
  }
  return result.data;
}

/** Reescribe el estado de la sesión. El registro no se toca. */
export function writeSession(
  markdown: string,
  input: { now: string; why: string; checkpoint: Checkpoint },
): string {
  let updated = replaceSection(markdown, NOW, input.now);
  updated = replaceSection(updated, WHY, input.why);
  updated = replaceSection(updated, NEXT, input.checkpoint.nextAction);
  return replaceSection(updated, CHECKPOINT, checkpointBlock(input.checkpoint));
}

/**
 * Añade una interacción al final del registro. Va dentro de su sección y no al
 * final del archivo, para que lo que alguien escriba después a mano siga suyo.
 */
export function appendInteraction(
  markdown: string,
  entry: { kind: string; content: string; at: Date },
): string {
  const lines = markdown.split('\n');
  const { end } = sectionBounds(lines, LOG);
  const block = [`### ${entry.kind} · ${entry.at.toISOString()}`, '', entry.content.trim(), ''];

  const tail = lines.slice(end);
  const body = lines.slice(0, end);
  while (body.length > 0 && body[body.length - 1]!.trim() === '') body.pop();

  return [...body, '', ...block, ...tail].join('\n');
}
