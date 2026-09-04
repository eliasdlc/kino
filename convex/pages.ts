import { z } from 'zod';
import { zid } from 'convex-helpers/server/zod4';
import { ConvexError } from 'convex/values';
import type { Doc, Id } from './_generated/dataModel';
import type { MutationCtx, QueryCtx } from './_generated/server';
import { countWords } from '../src/shared/lib/word-count';
import { forbidden, notFound } from './lib/errors';
import { kinoZodMutation, kinoZodQuery } from './lib/fn';
import { lematizar } from './lib/lemas';
import { recomputePageMentions } from './lib/mentions';
import { recordWritingActivity } from './lib/writing/activity';
import { tagItem } from './tags';

// Las páginas (cuadernos y capítulos). Guardar una recalcula sus menciones
// del codex y, en un sistema de escritura, extiende o abre la sesión.

type Ctx = QueryCtx | MutationCtx;
const iso = (ms: number | undefined) => (ms === undefined ? null : new Date(ms).toISOString());

function stripHtml(html: string | undefined): string | null {
  if (!html) return null;
  const text = html
    .replace(/<\/?(p|li|h[1-6]|br)[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 300);
  return text || null;
}

const alive = (doc: Doc<'pages'>) => doc.deletedAt === undefined;

async function ownPage(ctx: Ctx, userId: Id<'users'>, id: Id<'pages'>) {
  const doc = await ctx.db.get(id);
  if (!doc || doc.userId !== userId || !alive(doc)) notFound('Page not found');
  return doc;
}

async function tagsOf(ctx: Ctx, pageId: Id<'pages'>) {
  const links = await ctx.db.query('pageTags').withIndex('by_page_tag', (q) => q.eq('pageId', pageId)).collect();
  const tags = await Promise.all(links.map((link) => ctx.db.get(link.tagId)));
  return tags.flatMap((tag) => (tag ? [tagItem(tag)] : []));
}

async function subPageCount(ctx: Ctx, pageId: Id<'pages'>) {
  const kids = await ctx.db.query('pages').withIndex('by_parent', (q) => q.eq('parentPageId', pageId)).collect();
  return kids.filter(alive).length;
}

/** La página en lista: sin el contenido, con su vista previa y sus etiquetas. */
async function pageListItem(ctx: Ctx, doc: Doc<'pages'>, opts: { tags?: boolean; subPages?: boolean } = {}) {
  return {
    id: doc._id,
    title: doc.title ?? null,
    folderId: doc.folderId ?? null,
    systemId: doc.systemId ?? null,
    isPinned: doc.isPinned,
    parentPageId: doc.parentPageId ?? null,
    completedAt: iso(doc.completedAt),
    createdAt: iso(doc.createdAt)!,
    updatedAt: iso(doc.updatedAt)!,
    contentPreview: stripHtml(doc.content),
    wordCount: countWords(doc.content ?? null),
    tags: opts.tags === false ? [] : await tagsOf(ctx, doc._id),
    subPageCount: opts.subPages === false ? 0 : await subPageCount(ctx, doc._id),
  };
}
export type PageListItem = Awaited<ReturnType<typeof pageListItem>>;

/** Una tarea enlazada a la página, con lo que la tarjeta necesita. */
function linkedTask(doc: Doc<'tasks'>) {
  return {
    id: doc._id,
    title: doc.title,
    status: doc.status,
    priority: doc.priority,
    energyLevel: doc.energyLevel,
    dueDate: iso(doc.dueDate),
    startDate: iso(doc.startDate),
    description: doc.description ?? null,
    taskType: doc.taskType ?? null,
    estimatedTime: doc.estimatedTime ?? null,
    folderId: doc.folderId ?? null,
    systemId: doc.systemId,
    parentTaskId: doc.parentTaskId ?? null,
  };
}
export type LinkedTask = ReturnType<typeof linkedTask>;

async function linkedTasksOf(ctx: Ctx, userId: Id<'users'>, pageId: Id<'pages'>) {
  const links = await ctx.db.query('taskPageLinks').withIndex('by_page', (q) => q.eq('pageId', pageId)).collect();
  const tasks = await Promise.all(links.map((link) => ctx.db.get(link.taskId)));
  return tasks.flatMap((task) => (task && task.userId === userId && task.deletedAt === undefined ? [linkedTask(task)] : []));
}

// ── Lecturas ────────────────────────────────────────────────────────────────

export const bySystem = kinoZodQuery({
  args: { systemId: zid('systems') },
  handler: async (ctx, { systemId }) => {
    const docs = await ctx.db.query('pages').withIndex('by_system', (q) => q.eq('systemId', systemId)).collect();
    const own = docs.filter((doc) => doc.userId === ctx.user._id && alive(doc)).sort((a, b) => a.updatedAt - b.updatedAt);
    return Promise.all(own.map((doc) => pageListItem(ctx, doc)));
  },
});

/** Las páginas de un sistema con su contenido, para el export del workspace. */
export const forExport = kinoZodQuery({
  args: { systemId: zid('systems') },
  handler: async (ctx, { systemId }) => {
    const docs = await ctx.db.query('pages').withIndex('by_system', (q) => q.eq('systemId', systemId)).collect();
    const own = docs.filter((doc) => doc.userId === ctx.user._id && alive(doc)).sort((a, b) => a.updatedAt - b.updatedAt);
    return Promise.all(own.map(async (doc) => ({ ...(await pageListItem(ctx, doc)), content: doc.content ?? '' })));
  },
});

export const subpages = kinoZodQuery({
  args: { id: zid('pages') },
  handler: async (ctx, { id }) => {
    await ownPage(ctx, ctx.user._id, id);
    const docs = await ctx.db.query('pages').withIndex('by_parent', (q) => q.eq('parentPageId', id)).collect();
    const own = docs.filter((doc) => doc.userId === ctx.user._id && alive(doc)).sort((a, b) => a.createdAt - b.createdAt);
    return Promise.all(own.map((doc) => pageListItem(ctx, doc, { tags: false, subPages: false })));
  },
});

/** La página entera, con su contenido y las tareas enlazadas. */
export const byId = kinoZodQuery({
  args: { id: zid('pages') },
  handler: async (ctx, { id }) => {
    const doc = await ownPage(ctx, ctx.user._id, id);
    return {
      id: doc._id,
      userId: doc.userId,
      folderId: doc.folderId ?? null,
      systemId: doc.systemId ?? null,
      parentPageId: doc.parentPageId ?? null,
      title: doc.title ?? null,
      content: doc.content ?? null,
      isPinned: doc.isPinned,
      completedAt: iso(doc.completedAt),
      deletedAt: iso(doc.deletedAt),
      clientRequestId: doc.clientRequestId ?? null,
      createdAt: iso(doc.createdAt)!,
      updatedAt: iso(doc.updatedAt)!,
      linkedTasks: await linkedTasksOf(ctx, ctx.user._id, id),
    };
  },
});

export const linkedTasks = kinoZodQuery({
  args: { id: zid('pages') },
  handler: async (ctx, { id }) => {
    await ownPage(ctx, ctx.user._id, id);
    return linkedTasksOf(ctx, ctx.user._id, id);
  },
});

export const tags = kinoZodQuery({
  args: { id: zid('pages') },
  handler: async (ctx, { id }) => {
    await ownPage(ctx, ctx.user._id, id);
    return tagsOf(ctx, id);
  },
});

/** Búsqueda por lemas en título y cuerpo. */
export const search = kinoZodQuery({
  args: { query: z.string().min(1).max(200), systemId: zid('systems').optional() },
  handler: async (ctx, { query, systemId }) => {
    const lemas = lematizar(query);
    if (!lemas) return [];
    const docs = await ctx.db
      .query('pages')
      .withSearchIndex('search_lemas', (q) => {
        const base = q.search('lemas', lemas).eq('userId', ctx.user._id).eq('deletedAt', undefined);
        return systemId ? base.eq('systemId', systemId) : base;
      })
      .take(50);
    return Promise.all(docs.map((doc) => pageListItem(ctx, doc, { tags: false, subPages: false })));
  },
});

// ── Escrituras ──────────────────────────────────────────────────────────────

const createFields = {
  systemId: zid('systems'),
  folderId: zid('folders').optional(),
  parentPageId: zid('pages').optional(),
  title: z.string().max(500).optional(),
  content: z.string().nullable().optional(),
  clientRequestId: z.string().min(1).max(64).optional(),
};

async function createOne(ctx: MutationCtx, userId: Id<'users'>, input: z.infer<z.ZodObject<typeof createFields>>) {
  if (input.clientRequestId) {
    const existing = await ctx.db
      .query('pages')
      .withIndex('by_user_clientRequest', (q) => q.eq('userId', userId).eq('clientRequestId', input.clientRequestId))
      .unique();
    if (existing) return pageListItem(ctx, existing, { tags: false, subPages: false });
  }
  const system = await ctx.db.get(input.systemId);
  if (!system || system.userId !== userId) notFound('System not found');
  if (input.folderId) {
    const folder = await ctx.db.get(input.folderId);
    if (!folder || folder.userId !== userId || folder.systemId !== input.systemId) forbidden('Folder does not belong to this system');
  }
  if (input.parentPageId) {
    const parent = await ctx.db.get(input.parentPageId);
    if (!parent || parent.userId !== userId || !alive(parent) || parent.systemId !== input.systemId) {
      forbidden('Parent page does not belong to this system');
    }
  }
  const now = Date.now();
  const id = await ctx.db.insert('pages', {
    userId,
    systemId: input.systemId,
    folderId: input.folderId,
    parentPageId: input.parentPageId,
    title: input.title,
    content: input.content ?? undefined,
    isPinned: false,
    clientRequestId: input.clientRequestId,
    lemas: lematizar(input.title, input.content),
    createdBy: userId,
    createdVia: 'session',
    createdAt: now,
    updatedAt: now,
  });
  if (input.content) await recomputePageMentions(ctx, userId, id, input.systemId, input.content);
  return pageListItem(ctx, (await ctx.db.get(id))!, { tags: false, subPages: false });
}

export const create = kinoZodMutation({
  args: createFields,
  handler: async (ctx, input) => createOne(ctx, ctx.user._id, input),
});

/** Exportada para la siembra del onboarding, que crea páginas sin pasar por el cliente. */
export const createPageDoc = createOne;

export const update = kinoZodMutation({
  args: {
    id: zid('pages'),
    title: z.string().max(500).nullable().optional(),
    content: z.string().nullable().optional(),
    folderId: zid('folders').nullable().optional(),
    isPinned: z.boolean().optional(),
    /** Versión optimista: el `updatedAt` que traía la página al leerla. */
    expectedUpdatedAt: z.iso.datetime({ offset: true }).optional(),
  },
  handler: async (ctx, { id, expectedUpdatedAt, ...data }) => {
    const userId = ctx.user._id;
    const current = await ownPage(ctx, userId, id);
    // La versión se compara al milisegundo, que es lo que sobrevive al ISO.
    if (expectedUpdatedAt !== undefined && Date.parse(expectedUpdatedAt) !== current.updatedAt) {
      throw new ConvexError({
        code: 'CONFLICT' as const,
        message: 'La página cambió después de leerla. Vuelve a leerla y aplica el cambio sobre la versión nueva.',
      });
    }
    if (data.folderId) {
      const folder = await ctx.db.get(data.folderId);
      if (!folder || folder.userId !== userId || folder.systemId !== current.systemId) forbidden('Folder does not belong to this system');
    }
    const now = Date.now();
    const patch: Partial<Doc<'pages'>> = { updatedAt: now };
    if (data.title !== undefined) patch.title = data.title ?? undefined;
    if (data.content !== undefined) patch.content = data.content ?? undefined;
    if (data.folderId !== undefined) patch.folderId = data.folderId ?? undefined;
    if (data.isPinned !== undefined) patch.isPinned = data.isPinned;
    if (data.title !== undefined || data.content !== undefined) {
      patch.lemas = lematizar(data.title === undefined ? current.title : data.title, data.content === undefined ? current.content : data.content);
    }
    await ctx.db.patch(id, patch);
    const updated = (await ctx.db.get(id))!;

    if (data.content !== undefined) {
      await recomputePageMentions(ctx, userId, id, updated.systemId, updated.content);
      const system = updated.systemId ? await ctx.db.get(updated.systemId) : null;
      if (system?.templateType === 'writing' && current.content !== updated.content) {
        await recordWritingActivity(
          ctx,
          updated,
          countWords(updated.content ?? null) - countWords(current.content ?? null),
          current.content,
        );
      }
    }
    return { ...(await pageListItem(ctx, updated, { subPages: false })), content: updated.content ?? null };
  },
});

export const remove = kinoZodMutation({
  args: { id: zid('pages') },
  handler: async (ctx, { id }) => {
    await ownPage(ctx, ctx.user._id, id);
    await ctx.db.patch(id, { deletedAt: Date.now() });
    return null;
  },
});

export const linkTask = kinoZodMutation({
  args: { id: zid('pages'), taskId: zid('tasks') },
  handler: async (ctx, { id, taskId }) => {
    const page = await ownPage(ctx, ctx.user._id, id);
    if (!page.systemId) forbidden('Cannot link tasks to a page with no system');
    const task = await ctx.db.get(taskId);
    if (!task || task.userId !== ctx.user._id || task.systemId !== page.systemId || task.deletedAt !== undefined) {
      forbidden("Task does not belong to this page's system");
    }
    const existing = await ctx.db
      .query('taskPageLinks')
      .withIndex('by_task_page', (q) => q.eq('taskId', taskId).eq('pageId', id))
      .unique();
    if (!existing) await ctx.db.insert('taskPageLinks', { taskId, pageId: id });
    return null;
  },
});

export const unlinkTask = kinoZodMutation({
  args: { id: zid('pages'), taskId: zid('tasks') },
  handler: async (ctx, { id, taskId }) => {
    await ownPage(ctx, ctx.user._id, id);
    const link = await ctx.db
      .query('taskPageLinks')
      .withIndex('by_task_page', (q) => q.eq('taskId', taskId).eq('pageId', id))
      .unique();
    if (link) await ctx.db.delete(link._id);
    return null;
  },
});

export const addTag = kinoZodMutation({
  args: { id: zid('pages'), tagId: zid('contextTags') },
  handler: async (ctx, { id, tagId }) => {
    await ownPage(ctx, ctx.user._id, id);
    const tag = await ctx.db.get(tagId);
    if (!tag || tag.userId !== ctx.user._id) notFound('Tag not found');
    const existing = await ctx.db.query('pageTags').withIndex('by_page_tag', (q) => q.eq('pageId', id).eq('tagId', tagId)).unique();
    if (!existing) await ctx.db.insert('pageTags', { pageId: id, tagId });
    return null;
  },
});

export const removeTag = kinoZodMutation({
  args: { id: zid('pages'), tagId: zid('contextTags') },
  handler: async (ctx, { id, tagId }) => {
    await ownPage(ctx, ctx.user._id, id);
    const link = await ctx.db.query('pageTags').withIndex('by_page_tag', (q) => q.eq('pageId', id).eq('tagId', tagId)).unique();
    if (link) await ctx.db.delete(link._id);
    return null;
  },
});
