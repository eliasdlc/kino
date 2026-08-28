import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { appendInteraction, buildCheckpoint, readCheckpoint, renderSession, writeSession, } from '../utils/learning-session.js';
import { htmlToMarkdown, markdownToHtml } from '../utils/markdown.js';
/**
 * Sesiones de aprendizaje reanudables.
 *
 * Son las únicas tools que no salen del contrato, y por eso viven aparte de
 * `catalog.ts`: cada una es **una secuencia** sobre los endpoints que ya
 * existen (leer la página, reescribir su markdown, guardarla), no un endpoint
 * con otro nombre. Meterlas en el catálogo obligaría a inventar rutas que la
 * API no tiene.
 *
 * Lo que las justifica es que el agente, por su cuenta, tendría que acordarse
 * del formato del documento en cada llamada. Aquí el formato es código probado
 * (`utils/learning-session.ts`) y el agente sólo decide qué enseñar.
 *
 * La versión la impone el servidor, no estas tools: se le pasa el
 * `expectedUpdatedAt` que traía la última lectura del agente y es la API quien
 * responde 409 si la página cambió. Comprobarlo aquí antes de escribir dejaría
 * una ventana entre la comprobación y el guardado, que es justo el problema.
 */
/** Lo que hace falta de una página; el resto de la respuesta da igual. */
const storedPage = z.looseObject({
    id: z.uuid(),
    title: z.string().nullable().optional(),
    content: z.string().nullable().optional(),
    updatedAt: z.string(),
});
/** Lo que decide el agente en cada paso. El resto del checkpoint lo pone Kino. */
const checkpointInput = {
    currentNodeId: z.string().min(1).describe('Id estable del punto del material donde está el alumno'),
    lastUnderstood: z.string().describe('La última idea que el alumno demostró entender, con sus palabras si se puede'),
    openQuestion: z.string().nullable().optional().describe('La duda que quedó abierta, o null si no quedó ninguna'),
    nextAction: z.string().min(1).describe('Una sola acción concreta para retomar. Es lo primero que se lee al reanudar'),
    suggestedMinutes: z.number().int().min(1).max(90).describe('Cuánto debería durar el próximo bloque'),
};
const pageIdInput = z.uuid().describe('UUID de la página donde vive la sesión');
const versionInput = z.iso
    .datetime({ offset: true })
    .describe('El `updatedAt` que devolvió la última lectura o escritura de esta sesión. Si la página cambió desde entonces, la llamada falla con 409 en vez de pisar lo que haya: vuelve a leerla y reintenta sobre lo nuevo');
const json = (value) => ({
    content: [{ type: 'text', text: JSON.stringify(value, null, 2) }],
});
async function readSession(kinoFetch, pageId) {
    const page = storedPage.parse(await kinoFetch(`/api/pages/${pageId}`));
    const markdown = htmlToMarkdown(page.content);
    return { page, markdown, checkpoint: readCheckpoint(markdown) };
}
/** Guarda el documento entero. Devuelve la versión nueva para el siguiente paso. */
async function saveSession(kinoFetch, pageId, markdown, expectedUpdatedAt) {
    const saved = storedPage.parse(await kinoFetch(`/api/pages/${pageId}`, {
        method: 'PATCH',
        body: JSON.stringify({ content: markdownToHtml(markdown), expectedUpdatedAt }),
    }));
    return saved.updatedAt;
}
/** Lo que el agente necesita para seguir: dónde ibas y qué toca ahora. */
function resume(pageId, checkpoint) {
    return {
        pageId,
        currentNodeId: checkpoint.currentNodeId,
        nextAction: checkpoint.nextAction,
        suggestedMinutes: checkpoint.suggestedMinutes,
        openQuestion: checkpoint.openQuestion,
    };
}
export function registerLearningTools(server, kinoFetch) {
    server.tool('create_learning_session', 'Abre una sesión de aprendizaje reanudable en una página de Kino. La página queda escrita en markdown legible: qué toca ahora, por qué importa, qué sigue, el checkpoint para reanudar y un registro de lo que va pasando.', {
        systemId: z.uuid().describe('UUID del sistema de Kino donde vivirá la sesión'),
        folderId: z.uuid().optional().describe('UUID de la carpeta, si la sesión pertenece a una'),
        topic: z.string().min(1).max(480).describe('Qué se está aprendiendo'),
        now: z.string().min(1).describe('Qué debe atender el alumno ahora mismo'),
        why: z.string().min(1).describe('Por qué este paso importa para lo que quiere conseguir'),
        ...checkpointInput,
    }, async ({ systemId, folderId, topic, now, why, ...draft }) => {
        const checkpoint = buildCheckpoint(randomUUID(), draft, new Date());
        const markdown = renderSession({ topic, now, why, checkpoint });
        const page = storedPage.parse(await kinoFetch('/api/pages', {
            method: 'POST',
            body: JSON.stringify({
                systemId,
                folderId,
                title: `Aprendizaje: ${topic}`,
                content: markdownToHtml(markdown),
            }),
        }));
        return json({ pageId: page.id, updatedAt: page.updatedAt, checkpoint });
    });
    server.tool('get_learning_session', 'Recupera una sesión de aprendizaje lista para reanudar: el documento en markdown y el checkpoint con dónde se quedó el alumno. Empieza siempre por aquí antes de seguir enseñando.', { pageId: pageIdInput }, async ({ pageId }) => {
        const { page, markdown, checkpoint } = await readSession(kinoFetch, pageId);
        return json({
            pageId: page.id,
            title: page.title ?? null,
            // La versión que hay que devolver al guardar.
            updatedAt: page.updatedAt,
            contentFormat: 'markdown',
            content: markdown,
            checkpoint,
            resume: resume(page.id, checkpoint),
        });
    });
    server.tool('save_learning_checkpoint', 'Guarda dónde quedó la sesión: reescribe Ahora, Por qué, Después y el checkpoint. El registro de interacciones no se toca. Llámalo al terminar un paso, no en cada frase.', {
        pageId: pageIdInput,
        expectedUpdatedAt: versionInput,
        now: z.string().min(1).describe('Qué debe atender el alumno a partir de ahora'),
        why: z.string().min(1).describe('Por qué ese paso importa'),
        ...checkpointInput,
    }, async ({ pageId, expectedUpdatedAt, now, why, ...draft }) => {
        const { markdown, checkpoint: previous } = await readSession(kinoFetch, pageId);
        // El id de sesión es de la sesión, no del paso: se conserva entre guardados.
        const checkpoint = buildCheckpoint(previous.sessionId, draft, new Date());
        const updatedAt = await saveSession(kinoFetch, pageId, writeSession(markdown, { now, why, checkpoint }), expectedUpdatedAt);
        return json({ pageId, updatedAt, checkpoint });
    });
    server.tool('append_learning_interaction', 'Añade una interacción al registro de la sesión: una pregunta de sondeo, una explicación, una comprobación o una nota. Es la memoria de lo que ya se intentó, y sólo crece.', {
        pageId: pageIdInput,
        expectedUpdatedAt: versionInput,
        kind: z
            .enum(['probe', 'teach', 'check', 'note'])
            .describe('probe = sondear qué sabe, teach = explicar, check = comprobar, note = observación'),
        content: z.string().min(1).describe('Qué pasó, en markdown. La evidencia, no el resumen'),
        recordedAt: z.iso
            .datetime({ offset: true })
            .optional()
            .describe('Cuándo ocurrió, si no fue ahora mismo'),
    }, async ({ pageId, expectedUpdatedAt, kind, content, recordedAt }) => {
        const { markdown } = await readSession(kinoFetch, pageId);
        const at = recordedAt ? new Date(recordedAt) : new Date();
        const updatedAt = await saveSession(kinoFetch, pageId, appendInteraction(markdown, { kind, content, at }), expectedUpdatedAt);
        return json({ pageId, updatedAt, recordedAt: at.toISOString() });
    });
    server.tool('park_learning_thought', 'Aparca una idea o una distracción que salió a mitad de la sesión, como nota adhesiva en la página, y devuelve el punto exacto donde se estaba. Sirve para no perder lo que se le ocurrió al alumno ni el hilo de lo que estaba haciendo.', {
        pageId: pageIdInput,
        thought: z.string().min(1).max(500).describe('La idea, tal como la dijo el alumno'),
        title: z.string().max(200).optional().describe('Título breve para encontrarla después'),
    }, async ({ pageId, thought, title }) => {
        const { checkpoint } = await readSession(kinoFetch, pageId);
        const note = await kinoFetch(`/api/pages/${pageId}/sticky-notes`, {
            method: 'POST',
            body: JSON.stringify({
                title: title ?? 'Pensamiento aparcado',
                content: thought,
                color: 'yellow',
            }),
        });
        // No se escribe en el documento a propósito: aparcar una idea no cambia
        // dónde está el alumno, y hacerlo movería la versión de la página por algo
        // que no es aprendizaje.
        return json({ note, resume: resume(pageId, checkpoint) });
    });
}
