import { convexTest } from 'convex-test';
import { describe, expect, it } from 'vitest';
import { renderSceneBreak } from '../src/features/writing/plot-grid';
import { api } from './_generated/api';
import schema from './schema';

const modules = import.meta.glob('./**/*.*s');
const ana = { subject: 'user_ana', email: 'ana@usekino.dev', name: 'Ana' };

/** Los eventos que dejó una acción concreta, sin los de la siembra. */
const conAccion = (t: ReturnType<typeof convexTest>, action: string) =>
  t.run((ctx) => ctx.db.query('eventLog').collect().then((filas) => filas.filter((e) => e.action === action)));

async function seed() {
  const t = convexTest(schema, modules);
  const asAna = t.withIdentity(ana);
  const userId = await asAna.mutation(api.users.ensure, {});
  const systemId = await t.run((ctx) =>
    ctx.db.insert('systems', { userId, createdBy: userId, createdVia: 'session', name: 'Novela', color: 'purple', templateType: 'writing', icon: 'book', isActive: true, isInbox: false, sortOrder: 0, createdAt: 1, updatedAt: 1 }),
  );
  const work = await asAna.mutation(api.folders.create, { systemId, name: 'La obra' });
  const chapter = await asAna.mutation(api.pages.create, { systemId, folderId: work.id, title: 'Capítulo 1', content: '<p>Luffy zarpa.</p>' });
  return { t, asAna, userId, systemId, work, chapter };
}

describe('writing', () => {
  it('guardar un capítulo abre una sesión, cuenta palabras y deja el codex al día', async () => {
    const { asAna, systemId, work, chapter } = await seed();
    await asAna.mutation(api.entities.create, { systemId, type: 'character', name: 'Luffy', aliases: ['Sombrero de Paja'] });
    await asAna.mutation(api.pages.update, { id: chapter.id, content: '<p>Luffy zarpa. Sombrero de Paja ríe.</p>' });

    const journal = await asAna.query(api.writing.journal, { id: work.id });
    expect(journal.totalWords).toBe(6);
    expect(journal.days).toHaveLength(1);
    expect(journal.days[0].sessions[0].wordsWritten).toBe(4);

    const structure = await asAna.query(api.writing.structure, { id: work.id });
    expect(structure.chapters[0].entities).toMatchObject([{ name: 'Luffy', mentionCount: 2 }]);

    const overview = await asAna.query(api.writing.overview, { id: systemId });
    expect(overview).toMatchObject({ streakDays: 1, streakIncludesToday: true, wordsToday: 4 });
  });

  it('restaurar una versión guarda antes la actual', async () => {
    const { t, asAna, chapter } = await seed();
    await t.run(async (ctx) => {
      await ctx.db.insert('pageSnapshots', { pageId: chapter.id, userId: (await ctx.db.get(chapter.id))!.userId, content: '<p>Antes.</p>', wordCount: 1, createdAt: 5 });
    });
    const [old] = await asAna.query(api.writing.snapshots, { id: chapter.id });
    const restored = await asAna.mutation(api.writing.restoreSnapshot, { id: old.id });
    expect(restored.content).toBe('<p>Antes.</p>');
    const after = await asAna.query(api.writing.snapshots, { id: chapter.id });
    expect(after.map((s) => s.wordCount)).toEqual([2, 1]);
    expect((await asAna.query(api.pages.byId, { id: chapter.id })).content).toBe('<p>Antes.</p>');
  });

  it('la búsqueda en la historia devuelve fragmentos y la rejilla de escenas mueve texto', async () => {
    const { asAna, systemId, work, chapter } = await seed();
    const found = await asAna.query(api.writing.storySearch, { id: systemId, q: 'zarpa' });
    expect(found).toMatchObject([{ pageId: chapter.id, folderName: 'La obra' }]);
    const grid = await asAna.query(api.writing.plot, { id: work.id });
    expect(grid.chapters[0].scenes.length).toBeGreaterThan(0);
    const done = await asAna.mutation(api.writing.setCompleted, { id: chapter.id, completed: true });
    expect(done.completedAt).not.toBeNull();
  });
});

/**
 * El cuerpo de un capítulo se escribe por un solo sitio. Restaurar una versión
 * y mover una escena parcheaban `content` a mano: sin versión archivada, sin
 * lemas, sin menciones y sin evento, y además sin mover la versión con la que
 * el editor decide si lo suyo llegó tarde.
 */
describe('un solo camino de escritura', () => {
  it('restaurar una versión deja versión, evento, lemas y menciones como un guardado', async () => {
    const { t, asAna, systemId, work, chapter } = await seed();
    await asAna.mutation(api.entities.create, { systemId, type: 'character', name: 'Luffy', aliases: [] });
    // Escribir encima archiva el texto original, que es el que se va a recuperar.
    await asAna.mutation(api.pages.update, { id: chapter.id, content: '<p>Nadie duerme.</p>' });
    expect(await asAna.query(api.pages.search, { query: 'zarpa', systemId })).toHaveLength(0);
    const [vieja] = await asAna.query(api.writing.snapshots, { id: chapter.id });

    const restaurado = await asAna.mutation(api.writing.restoreSnapshot, { id: vieja.id });
    expect(restaurado.content).toBe('<p>Luffy zarpa.</p>');

    // Lo que había antes de restaurar también queda guardado: se puede deshacer.
    const versiones = await asAna.query(api.writing.snapshots, { id: chapter.id });
    expect(versiones).toHaveLength(2);
    expect((await asAna.query(api.writing.snapshot, { id: versiones[0]!.id })).content).toBe('<p>Nadie duerme.</p>');

    // Lemas y menciones vuelven con el texto, no se quedan en la versión pisada.
    expect((await asAna.query(api.pages.search, { query: 'zarpa', systemId })).map((p) => p.id)).toEqual([chapter.id]);
    const estructura = await asAna.query(api.writing.structure, { id: work.id });
    expect(estructura.chapters[0]!.entities).toMatchObject([{ name: 'Luffy', mentionCount: 1 }]);

    const eventos = await conAccion(t, 'page.update');
    expect(eventos).toHaveLength(2);
    expect(eventos[1]).toMatchObject({ targetId: chapter.id, payload: { contenidoCambiado: true } });
    expect(eventos[1]!.snapshotId).toBeDefined();
  });

  it('el autosave que venía detrás de una restauración choca en vez de deshacerla', async () => {
    const { asAna, chapter } = await seed();
    await asAna.mutation(api.pages.update, { id: chapter.id, content: '<p>Nadie duerme.</p>' });
    // La pestaña tiene abierto el texto de ahora y su versión; teclear manda las dos.
    const abierta = await asAna.query(api.pages.byId, { id: chapter.id });
    const [vieja] = await asAna.query(api.writing.snapshots, { id: chapter.id });

    await asAna.mutation(api.writing.restoreSnapshot, { id: vieja!.id });

    await expect(
      asAna.mutation(api.pages.update, { id: chapter.id, content: abierta.content!, expectedUpdatedAt: abierta.updatedAt }),
    ).rejects.toThrow(/CONFLICT|cambió después de leerla/);
    expect((await asAna.query(api.pages.byId, { id: chapter.id })).content).toBe('<p>Luffy zarpa.</p>');
  });

  it('mover una escena deja versión archivada, evento y lemas recalculados en los dos capítulos', async () => {
    const { t, asAna, systemId, work, chapter } = await seed();
    await asAna.mutation(api.entities.create, { systemId, type: 'character', name: 'Zoro', aliases: [] });
    await asAna.mutation(api.pages.update, {
      id: chapter.id,
      content: `<p>Luffy zarpa.</p>${renderSceneBreak(null, false)}<p>Zoro entrena en Wano.</p>`,
    });
    const segundo = await asAna.mutation(api.pages.create, { systemId, folderId: work.id, title: 'Capítulo 2', content: '<p>Nami mira el mapa.</p>' });

    const rejilla = await asAna.mutation(api.writing.applyPlotOperation, {
      id: work.id,
      operation: { kind: 'move', chapterId: chapter.id, index: 1, toChapterId: segundo.id, toIndex: 1 },
    });
    expect(rejilla.chapters.map((c) => c.scenes.length)).toEqual([1, 2]);

    // Cada capítulo reescrito guardó cómo estaba antes del movimiento.
    expect(await asAna.query(api.writing.snapshots, { id: chapter.id })).toHaveLength(2);
    expect(await asAna.query(api.writing.snapshots, { id: segundo.id })).toHaveLength(1);

    // La escena se llevó sus lemas y sus menciones al capítulo destino.
    expect((await asAna.query(api.pages.search, { query: 'Wano', systemId })).map((p) => p.id)).toEqual([segundo.id]);
    const estructura = await asAna.query(api.writing.structure, { id: work.id });
    expect(estructura.chapters[0]!.entities).toEqual([]);
    expect(estructura.chapters[1]!.entities).toMatchObject([{ name: 'Zoro', mentionCount: 1 }]);

    const eventos = await conAccion(t, 'page.update');
    expect(eventos.map((e) => e.targetId)).toEqual([chapter.id, chapter.id, segundo.id]);
    expect(eventos.slice(1).every((e) => e.snapshotId !== undefined)).toBe(true);
  });

  it('restaurar una versión no cuenta como escribir, y mover una escena sí', async () => {
    const { t, asAna, systemId, work, chapter } = await seed();
    // El texto se pone a mano: un `pages.update` abriría ya la sesión que este
    // test quiere ver nacer, o no nacer, más adelante.
    await t.run(async (ctx) => {
      await ctx.db.insert('pageSnapshots', {
        pageId: chapter.id,
        userId: (await ctx.db.get(chapter.id))!.userId,
        content: '<p>Sólo Luffy.</p>',
        wordCount: 2,
        createdAt: 5,
      });
    });
    const [vieja] = await asAna.query(api.writing.snapshots, { id: chapter.id });

    await asAna.mutation(api.writing.restoreSnapshot, { id: vieja!.id });

    // Deshacer no es escribir: la racha no se sostiene volviendo atrás.
    expect(await t.run((ctx) => ctx.db.query('timeLogs').collect())).toEqual([]);
    expect(await asAna.query(api.writing.overview, { id: systemId })).toMatchObject({ streakDays: 0, wordsToday: 0 });

    // Mover una escena es trabajo estructural sobre la obra, y sí cuenta.
    await t.run((ctx) =>
      ctx.db.patch(chapter.id, { content: `<p>Luffy zarpa.</p>${renderSceneBreak(null, false)}<p>Zoro entrena.</p>` }),
    );
    const segundo = await asAna.mutation(api.pages.create, { systemId, folderId: work.id, title: 'Capítulo 2', content: '<p>Nami mira el mapa.</p>' });
    await asAna.mutation(api.writing.applyPlotOperation, {
      id: work.id,
      operation: { kind: 'move', chapterId: chapter.id, index: 1, toChapterId: segundo.id, toIndex: 1 },
    });

    expect(await t.run((ctx) => ctx.db.query('timeLogs').collect())).not.toEqual([]);
    expect(await asAna.query(api.writing.overview, { id: systemId })).toMatchObject({ streakDays: 1 });
  });
});
