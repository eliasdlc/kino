import { convexTest } from 'convex-test';
import { describe, expect, it } from 'vitest';
import { api } from './_generated/api';
import schema from './schema';

const modules = import.meta.glob('./**/*.*s');
const ana = { subject: 'user_ana', email: 'ana@usekino.dev', name: 'Ana' };

async function seed() {
  const t = convexTest(schema, modules);
  const asAna = t.withIdentity(ana);
  const userId = await asAna.mutation(api.users.ensure, {});
  const systemId = await t.run((ctx) =>
    ctx.db.insert('systems', { userId, name: 'Novela', color: 'purple', templateType: 'writing', icon: 'book', isActive: true, isInbox: false, sortOrder: 0, createdAt: 1, updatedAt: 1 }),
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
