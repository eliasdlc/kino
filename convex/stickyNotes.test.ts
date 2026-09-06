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
  const { systemId, folderId, pageId } = await t.run(async (ctx) => {
    const systemId = await ctx.db.insert('systems', { userId, createdBy: userId, createdVia: 'session', name: 'Novela', color: 'purple', templateType: 'writing', icon: 'book', isActive: true, isInbox: false, sortOrder: 0, createdAt: 1, updatedAt: 1 });
    const folderId = await ctx.db.insert('folders', { userId, createdBy: userId, createdVia: 'session', systemId, name: 'Parte 1', color: 'blue', sortIndex: 0, createdAt: 1, updatedAt: 1 });
    const pageId = await ctx.db.insert('pages', { userId, createdBy: userId, createdVia: 'session', systemId, folderId, isPinned: false, createdAt: 1, updatedAt: 1 });
    return { systemId, folderId, pageId };
  });
  return { t, asAna, systemId, folderId, pageId };
}

describe('stickyNotes', () => {
  it('cuelga de una página o de una carpeta y hereda el sistema', async () => {
    const { asAna, folderId, pageId, systemId, t } = await seed();
    const onPage = await asAna.mutation(api.stickyNotes.createOnPage, { pageId, content: 'Idea', positionSide: 'over', positionX: -0.2, positionY: 0.8 });
    const onFolder = await asAna.mutation(api.stickyNotes.createOnFolder, { folderId, title: 'Recordar' });
    expect(onPage).toMatchObject({ pageId, folderId: null, positionSide: 'over' });
    expect(onFolder).toMatchObject({ pageId: null, folderId });
    expect((await asAna.query(api.stickyNotes.byPage, { pageId })).map((n) => n.id)).toEqual([onPage.id]);
    expect((await asAna.query(api.stickyNotes.byFolder, { folderId })).map((n) => n.id)).toEqual([onFolder.id]);
    const docs = await t.run((ctx) => ctx.db.query('stickyNotes').collect());
    expect(docs.every((doc) => doc.systemId === systemId)).toBe(true);
  });

  it('apilar comparte el stackId de la primera y la misma petición offline no duplica', async () => {
    const { asAna, pageId } = await seed();
    const a = await asAna.mutation(api.stickyNotes.createOnPage, { pageId, content: 'A', clientRequestId: 'r1' });
    const again = await asAna.mutation(api.stickyNotes.createOnPage, { pageId, content: 'A', clientRequestId: 'r1' });
    expect(again.id).toBe(a.id);
    const b = await asAna.mutation(api.stickyNotes.createOnPage, { pageId, content: 'B' });
    const stacked = await asAna.mutation(api.stickyNotes.stack, { draggedId: b.id, targetId: a.id });
    expect(stacked.dragged.stackId).toBe(a.id);
    expect(stacked.target.stackId).toBe(a.id);
    const updated = await asAna.mutation(api.stickyNotes.update, { id: b.id, isEureka: true, content: 'Eureka' });
    expect(updated).toMatchObject({ isEureka: true, content: 'Eureka' });
    await asAna.mutation(api.stickyNotes.remove, { id: b.id });
    expect((await asAna.query(api.stickyNotes.byPage, { pageId })).map((n) => n.id)).toEqual([a.id]);
  });
});
