import { convexTest } from 'convex-test';
import { ConvexError, type Value } from 'convex/values';
import { describe, expect, it } from 'vitest';
import { api } from './_generated/api';
import { MCP_TOKEN_ISSUER } from './lib/mcpToken';
import { MAX_COMMENTS_PER_REVIEW, reviewProgress } from './lib/reviews';
import schema from './schema';

/**
 * La revisión de un documento contra la base real. Lo que se prueba es lo que
 * no se puede romper sin que la persona lo note: que una cita que no existe no
 * se guarda, que la barra pesa por severidad y cuenta los descartes, que la
 * pasada se cierra una sola vez, que cada lado tiene su turno en el hilo, y que
 * nadie lee ni toca los comentarios de otro.
 */

const modules = import.meta.glob('./**/*.*s');
const ana = { subject: 'user_ana', email: 'ana@usekino.dev', name: 'Ana' };
const beto = { subject: 'user_beto', email: 'beto@usekino.dev', name: 'Beto' };

const TEXTO =
  '<p>QSD tiene firewall perimetral y respaldos.</p>' +
  '<p>La información puede ser clasificada como prueba. Después, la información puede ser clasificada como debilidad.</p>';

async function seed() {
  const t = convexTest(schema, modules);
  const asAna = t.withIdentity(ana);
  await asAna.mutation(api.users.ensure, {});
  const system = await asAna.mutation(api.systems.create, { name: 'Universidad', color: 'blue', templateType: 'academic', icon: 'book' });
  const page = await asAna.mutation(api.pages.create, { systemId: system.id, title: 'Informe de seguridad', content: TEXTO });
  const agente = t.withIdentity({ ...ana, issuer: MCP_TOKEN_ISSUER, kino_scope: 'write', kino_client: 'claude_code' });
  return { t, asAna, agente, pageId: page.id };
}

function errorData(error: unknown): Record<string, unknown> {
  expect(error).toBeInstanceOf(ConvexError);
  return (error as ConvexError<Value>).data as unknown as Record<string, unknown>;
}

const critico = { quote: 'firewall perimetral', category: 'evidence', severity: 'critical', body: '¿Qué controles faltan?' } as const;
const detalle = { quote: 'como prueba', category: 'grammar', severity: 'suggestion', body: 'Falta la coma.' } as const;

describe('una pasada de revisión', () => {
  it('el agente la deja entera y la persona la ve en su página, sin barra llena', async () => {
    const { asAna, agente, pageId } = await seed();
    const review = await agente.mutation(api.reviews.create, {
      pageId,
      summary: 'El diagnóstico exagera.',
      reviewer: 'Claude',
      comments: [critico, detalle],
    });

    expect(review).toMatchObject({ reviewer: 'Claude', author: 'agent', closedAt: null });
    const panel = await asAna.query(api.reviews.byPage, { pageId });
    expect(panel.comments).toHaveLength(2);
    expect(panel.comments.every((c) => c.author === 'agent' && c.status === 'open')).toBe(true);
    expect(panel.progress).toMatchObject({ total: 2, closed: 0, fraction: 0 });
  });

  it('no guarda nada si una cita no está en el texto, y dice cuál', async () => {
    const { asAna, agente, pageId } = await seed();
    const error = await agente
      .mutation(api.reviews.create, { pageId, comments: [critico, { ...detalle, quote: 'cortafuegos de capa siete' }] })
      .catch((e: unknown) => e);

    const data = errorData(error);
    expect(data.code).toBe('VALIDATION_ERROR');
    expect(String(data.message)).toContain('#1');
    expect((await asAna.query(api.reviews.byPage, { pageId })).comments).toEqual([]);
  });

  it('pide contexto cuando la cita se repite, y lo acepta cuando llega', async () => {
    const { agente, pageId } = await seed();
    const repetida = { ...detalle, quote: 'puede ser clasificada' };

    const error = await agente.mutation(api.reviews.create, { pageId, comments: [repetida] }).catch((e: unknown) => e);
    expect(String(errorData(error).message)).toContain('aparece 2 veces');

    await expect(
      agente.mutation(api.reviews.create, { pageId, comments: [{ ...repetida, suffix: 'como debilidad' }] }),
    ).resolves.toMatchObject({ closedAt: null });
  });

  it(`no admite más de ${MAX_COMMENTS_PER_REVIEW} comentarios de una vez`, async () => {
    const { agente, pageId } = await seed();
    const muchos = Array.from({ length: MAX_COMMENTS_PER_REVIEW + 1 }, () => detalle);
    await expect(agente.mutation(api.reviews.create, { pageId, comments: muchos })).rejects.toThrow();
  });
});

describe('la barra', () => {
  it('pesa por severidad: cerrar lo crítico mueve más que cerrar un detalle', () => {
    const soloDetalle = reviewProgress([
      { status: 'open', severity: 'critical' },
      { status: 'resolved', severity: 'suggestion', resolution: 'marked' },
    ]);
    const soloCritico = reviewProgress([
      { status: 'resolved', severity: 'critical', resolution: 'edited' },
      { status: 'open', severity: 'suggestion' },
    ]);
    expect(soloCritico.fraction).toBeGreaterThan(soloDetalle.fraction);
    expect(soloCritico.fraction).toBeCloseTo(3 / 4);
    expect(soloDetalle.openBySeverity).toEqual({ critical: 1, important: 0, suggestion: 0 });
  });

  it('cuenta un descarte como avance, y lo separa en el resumen', () => {
    const progreso = reviewProgress([
      { status: 'dismissed', severity: 'important' },
      { status: 'resolved', severity: 'important', resolution: 'applied' },
    ]);
    expect(progreso.fraction).toBe(1);
    expect(progreso.closedHow).toMatchObject({ dismissed: 1, applied: 1, edited: 0 });
  });
});

describe('cerrar la pasada', () => {
  it('se cierra una vez, con el último comentario, y reabrir la devuelve', async () => {
    const { asAna, agente, pageId } = await seed();
    await agente.mutation(api.reviews.create, { pageId, comments: [critico, detalle] });
    const [primero, segundo] = (await asAna.query(api.reviews.byPage, { pageId })).comments;

    expect((await asAna.mutation(api.reviews.resolve, { id: primero!.id, resolution: 'edited' })).reviewClosed).toBe(false);
    expect((await asAna.mutation(api.reviews.dismiss, { id: segundo!.id, reason: 'Lo quiero así' })).reviewClosed).toBe(true);
    // Repetir el gesto sobre algo ya cerrado no vuelve a celebrar.
    expect((await asAna.mutation(api.reviews.resolve, { id: segundo!.id })).reviewClosed).toBe(false);

    let panel = await asAna.query(api.reviews.byPage, { pageId });
    expect(panel.reviews[0]!.closedAt).not.toBeNull();
    // La barra se queda llena: la de la pasada que se acaba de cerrar.
    expect(panel.progress).toMatchObject({ total: 2, open: 0, fraction: 1 });
    expect(panel.comments.find((c) => c.id === segundo!.id)!.replies[0]).toMatchObject({ author: 'person', body: 'Lo quiero así' });

    await asAna.mutation(api.reviews.reopen, { id: primero!.id });
    panel = await asAna.query(api.reviews.byPage, { pageId });
    expect(panel.reviews[0]!.closedAt).toBeNull();
    expect(panel.progress.open).toBe(1);
  });

  it('el agente cierra comprobando, y su cierre se distingue del de la persona', async () => {
    const { asAna, agente, pageId } = await seed();
    await agente.mutation(api.reviews.create, { pageId, comments: [critico] });
    const [comentario] = (await asAna.query(api.reviews.byPage, { pageId })).comments;

    await agente.mutation(api.reviews.resolve, { id: comentario!.id, resolution: 'applied', note: 'Ya nombra los controles que faltan.' });
    const [cerrado] = (await asAna.query(api.reviews.byPage, { pageId })).comments;
    expect(cerrado).toMatchObject({ status: 'resolved', resolution: 'verified' });
    expect(cerrado!.replies[0]).toMatchObject({ author: 'agent' });
  });
});

describe('el hilo', () => {
  it('una pregunta de la persona espera al agente, y la respuesta le devuelve el turno', async () => {
    const { asAna, agente, pageId } = await seed();
    const pregunta = await asAna.mutation(api.reviews.ask, { pageId, quote: 'respaldos', body: '¿Esto cuenta como control?' });
    expect(pregunta).toMatchObject({ author: 'person', awaiting: 'agent', reviewId: null });

    const espera = await agente.query(api.reviews.awaitingAgent, {});
    expect(espera.map((c) => c.id)).toEqual([pregunta.id]);
    expect(espera[0]!.pageTitle).toBe('Informe de seguridad');

    const contestada = await agente.mutation(api.reviews.reply, { id: pregunta.id, body: 'Sí, si hay pruebas de restauración.' });
    expect(contestada.awaiting).toBe('person');
    expect(await agente.query(api.reviews.awaitingAgent, {})).toEqual([]);
  });

  it('el agente no cierra la pregunta de la persona ni retira lo que ella escribió', async () => {
    const { asAna, agente, pageId } = await seed();
    const pregunta = await asAna.mutation(api.reviews.ask, { pageId, quote: 'respaldos', body: '¿Cuenta?' });

    expect(errorData(await agente.mutation(api.reviews.resolve, { id: pregunta.id }).catch((e: unknown) => e)).code).toBe('FORBIDDEN');
    expect(errorData(await agente.mutation(api.reviews.dismiss, { id: pregunta.id }).catch((e: unknown) => e)).code).toBe('FORBIDDEN');
    expect(errorData(await agente.mutation(api.reviews.update, { id: pregunta.id, body: 'Otra' }).catch((e: unknown) => e)).code).toBe(
      'FORBIDDEN',
    );
  });

  it('para la segunda pasada, el agente ve qué citas ya no están en el texto', async () => {
    const { asAna, agente, pageId } = await seed();
    await agente.mutation(api.reviews.create, { pageId, comments: [critico, detalle] });
    // La persona reescribe uno de los dos fragmentos con sus palabras.
    await asAna.mutation(api.pages.update, { id: pageId, content: TEXTO.replace('como prueba', 'como evidencia') });

    const vista = await agente.query(api.reviews.forAgent, { pageId });
    const anclas = Object.fromEntries(vista.comments.map((c) => [c.quote, c.anchor]));
    expect(anclas).toEqual({ 'firewall perimetral': 'found', 'como prueba': 'missing' });
  });
});

describe('el alcance', () => {
  it('un agente que sólo propone revisa y contesta, pero no da nada por resuelto', async () => {
    const { t, pageId } = await seed();
    const proponente = t.withIdentity({ ...ana, issuer: MCP_TOKEN_ISSUER, kino_scope: 'propose', kino_client: 'claude_desktop' });

    await proponente.mutation(api.reviews.create, { pageId, comments: [critico] });
    const [comentario] = (await proponente.query(api.reviews.forAgent, { pageId })).comments;
    await expect(proponente.mutation(api.reviews.reply, { id: comentario!.id, body: 'Mira la tabla 1.' })).resolves.toBeTruthy();

    const error = await proponente.mutation(api.reviews.resolve, { id: comentario!.id }).catch((e: unknown) => e);
    expect(errorData(error).code).toBe('FORBIDDEN_SCOPE');
  });
});

describe('aislamiento', () => {
  it('nadie lee ni contesta los comentarios de otra persona', async () => {
    const { t, agente, pageId } = await seed();
    await agente.mutation(api.reviews.create, { pageId, comments: [critico] });
    const asBeto = t.withIdentity(beto);
    await asBeto.mutation(api.users.ensure, {});

    expect((await asBeto.query(api.reviews.byPage, { pageId })).comments).toEqual([]);
    const [comentario] = (await t.withIdentity(ana).query(api.reviews.byPage, { pageId })).comments;
    expect(errorData(await asBeto.mutation(api.reviews.reply, { id: comentario!.id, body: 'Hola' }).catch((e: unknown) => e)).code).toBe(
      'NOT_FOUND',
    );
  });

  it('una página en la papelera se lleva su revisión de la vista, y vuelve con ella', async () => {
    const { asAna, agente, pageId } = await seed();
    await agente.mutation(api.reviews.create, { pageId, comments: [critico] });
    await asAna.mutation(api.pages.remove, { id: pageId });
    expect((await asAna.query(api.reviews.byPage, { pageId })).comments).toEqual([]);

    await asAna.mutation(api.pages.restore, { id: pageId });
    expect((await asAna.query(api.reviews.byPage, { pageId })).comments).toHaveLength(1);
  });
});
