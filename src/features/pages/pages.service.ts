import { db } from "@/shared/db";
import { pages, tasks, taskPageLinks, folders, pageTags, contextTags } from "@/shared/db/schema";
import { and, eq, isNull, inArray, count } from "drizzle-orm";
import { NotFoundError, ForbiddenError } from "@/shared/utils/error";
import type { CreatePageInput, UpdatePageInput } from "./pages.schemas";
import type { PageDetail, PageListItem, LinkedTask, PageMutationResult } from "./pages.types";
import type { ContextTagListItem } from "@/features/tags/tags.types";
import { countWords } from "./word-count";

function stripHtml(html: string | null | undefined): string | null {
  if (!html) return null;
  const text = html
    .replace(/<\/?(p|li|h[1-6]|br)[^>]*>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);
  return text || null;
}

export async function getPagesBySystem(
  systemId: string,
  userId: string
): Promise<PageListItem[]> {
  const rows = await db
    .select({
      id: pages.id,
      title: pages.title,
      folderId: pages.folderId,
      systemId: pages.systemId,
      isPinned: pages.isPinned,
      parentPageId: pages.parentPageId,
      createdAt: pages.createdAt,
      updatedAt: pages.updatedAt,
      content: pages.content,
    })
    .from(pages)
    .where(
      and(
        eq(pages.systemId, systemId),
        eq(pages.userId, userId),
        isNull(pages.deletedAt)
      )
    )
    .orderBy(pages.updatedAt);

  if (rows.length === 0) return [];

  const pageIds = rows.map((r) => r.id);

  const [tagRows, subPageCounts] = await Promise.all([
    db
      .select({
        pageId: pageTags.pageId,
        id: contextTags.id,
        title: contextTags.title,
        color: contextTags.color,
        systemId: contextTags.systemId,
        isDefault: contextTags.isDefault,
      })
      .from(pageTags)
      .innerJoin(contextTags, eq(pageTags.tagId, contextTags.id))
      .where(inArray(pageTags.pageId, pageIds)),
    db
      .select({ parentPageId: pages.parentPageId, count: count() })
      .from(pages)
      .where(
        and(
          inArray(pages.parentPageId, pageIds),
          isNull(pages.deletedAt)
        )
      )
      .groupBy(pages.parentPageId),
  ]);

  const tagsByPage = new Map<string, ContextTagListItem[]>();
  for (const row of tagRows) {
    const list = tagsByPage.get(row.pageId) ?? [];
    list.push({ id: row.id, title: row.title, color: row.color, systemId: row.systemId, isDefault: row.isDefault });
    tagsByPage.set(row.pageId, list);
  }

  const subCountByPage = new Map<string, number>();
  for (const row of subPageCounts) {
    if (row.parentPageId) subCountByPage.set(row.parentPageId, row.count);
  }

  return rows.map(({ content, ...rest }) => ({
    ...rest,
    contentPreview: stripHtml(content),
    wordCount: countWords(content),
    tags: tagsByPage.get(rest.id) ?? [],
    subPageCount: subCountByPage.get(rest.id) ?? 0,
  }));
}

export async function getPagesBySystemForExport(
  systemId: string,
  userId: string
): Promise<Array<{ id: string; title: string | null; content: string | null; createdAt: Date; updatedAt: Date }>> {
  return db
    .select({
      id: pages.id,
      title: pages.title,
      content: pages.content,
      createdAt: pages.createdAt,
      updatedAt: pages.updatedAt,
    })
    .from(pages)
    .where(and(eq(pages.systemId, systemId), eq(pages.userId, userId), isNull(pages.deletedAt)));
}

export async function getSubPages(
  parentPageId: string,
  userId: string
): Promise<PageListItem[]> {
  const rows = await db
    .select({
      id: pages.id,
      title: pages.title,
      folderId: pages.folderId,
      systemId: pages.systemId,
      isPinned: pages.isPinned,
      parentPageId: pages.parentPageId,
      createdAt: pages.createdAt,
      updatedAt: pages.updatedAt,
      content: pages.content,
    })
    .from(pages)
    .where(
      and(
        eq(pages.parentPageId, parentPageId),
        eq(pages.userId, userId),
        isNull(pages.deletedAt)
      )
    )
    .orderBy(pages.createdAt);

  return rows.map(({ content, ...rest }) => ({
    ...rest,
    contentPreview: stripHtml(content),
    wordCount: countWords(content),
    tags: [],
    subPageCount: 0,
  }));
}

export async function getPageById(
  pageId: string,
  userId: string
): Promise<PageDetail | null> {
  const [page] = await db
    .select()
    .from(pages)
    .where(
      and(eq(pages.id, pageId), eq(pages.userId, userId), isNull(pages.deletedAt))
    );

  if (!page) return null;

  const linkedTasks = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      status: tasks.status,
      priority: tasks.priority,
      energyLevel: tasks.energyLevel,
      dueDate: tasks.dueDate,
      startDate: tasks.startDate,
      description: tasks.description,
      taskType: tasks.taskType,
      estimatedTime: tasks.estimatedTime,
      folderId: tasks.folderId,
      systemId: tasks.systemId,
      parentTaskId: tasks.parentTaskId,
    })
    .from(taskPageLinks)
    .innerJoin(tasks, eq(taskPageLinks.taskId, tasks.id))
    .where(
      and(eq(taskPageLinks.pageId, pageId), isNull(tasks.deletedAt))
    );

  return { ...page, linkedTasks };
}

export async function createPage(
  userId: string,
  input: CreatePageInput
): Promise<PageListItem> {
  if (input.folderId) {
    const [folder] = await db.select({ systemId: folders.systemId })
      .from(folders)
      .where(and(eq(folders.id, input.folderId), eq(folders.userId, userId)));
    if (!folder || folder.systemId !== input.systemId) {
      throw new ForbiddenError("Folder does not belong to this system");
    }
  }

  // La página padre debe ser del usuario y del mismo sistema (hoy sólo se
  // validaba folderId, dejando parentPageId sin verificar ownership).
  if (input.parentPageId) {
    const [parent] = await db.select({ systemId: pages.systemId })
      .from(pages)
      .where(and(eq(pages.id, input.parentPageId), eq(pages.userId, userId), isNull(pages.deletedAt)));
    if (!parent || parent.systemId !== input.systemId) {
      throw new ForbiddenError("Parent page does not belong to this system");
    }
  }

  const [created] = await db
    .insert(pages)
    .values({
      userId,
      systemId: input.systemId,
      folderId: input.folderId ?? null,
      parentPageId: input.parentPageId ?? null,
      title: input.title ?? null,
      content: input.content ?? null,
    })
    .returning({
      id: pages.id,
      title: pages.title,
      folderId: pages.folderId,
      systemId: pages.systemId,
      isPinned: pages.isPinned,
      parentPageId: pages.parentPageId,
      createdAt: pages.createdAt,
      updatedAt: pages.updatedAt,
    });

  return { ...created!, contentPreview: null, wordCount: countWords(input.content), tags: [], subPageCount: 0 };
}

export async function updatePage(
  pageId: string,
  userId: string,
  data: UpdatePageInput
): Promise<PageMutationResult | null> {
  const [updated] = await db
    .update(pages)
    .set({ ...data, updatedAt: new Date() })
    .where(
      and(eq(pages.id, pageId), eq(pages.userId, userId), isNull(pages.deletedAt))
    )
    .returning({
      id: pages.id,
      title: pages.title,
      folderId: pages.folderId,
      systemId: pages.systemId,
      isPinned: pages.isPinned,
      parentPageId: pages.parentPageId,
      content: pages.content,
      createdAt: pages.createdAt,
      updatedAt: pages.updatedAt,
    });

  if (!updated) return null;

  const existingTags = await db
    .select({
      id: contextTags.id,
      title: contextTags.title,
      color: contextTags.color,
      systemId: contextTags.systemId,
      isDefault: contextTags.isDefault,
    })
    .from(pageTags)
    .innerJoin(contextTags, eq(pageTags.tagId, contextTags.id))
    .where(eq(pageTags.pageId, pageId));

  return { ...updated, contentPreview: stripHtml(updated.content), wordCount: countWords(updated.content), tags: existingTags, subPageCount: 0 };
}

export async function deletePage(
  pageId: string,
  userId: string
): Promise<boolean> {
  const [deleted] = await db
    .update(pages)
    .set({ deletedAt: new Date() })
    .where(
      and(eq(pages.id, pageId), eq(pages.userId, userId), isNull(pages.deletedAt))
    )
    .returning({ id: pages.id });

  return !!deleted;
}

export async function linkTaskToPage(
  pageId: string,
  taskId: string,
  userId: string
): Promise<boolean> {
  const [page] = await db
    .select({ id: pages.id, systemId: pages.systemId })
    .from(pages)
    .where(and(eq(pages.id, pageId), eq(pages.userId, userId), isNull(pages.deletedAt)));

  if (!page) throw new NotFoundError("Page not found");
  if (!page.systemId) throw new ForbiddenError("Cannot link tasks to a page with no system");

  const [task] = await db.select({ id: tasks.id })
    .from(tasks)
    .where(and(
      eq(tasks.id, taskId),
      eq(tasks.userId, userId),
      eq(tasks.systemId, page.systemId),
      isNull(tasks.deletedAt)
    ));

  if (!task) throw new ForbiddenError("Task does not belong to this page's system");

  const inserted = await db
    .insert(taskPageLinks)
    .values({ taskId, pageId })
    .onConflictDoNothing()
    .returning({ taskId: taskPageLinks.taskId });

  return inserted.length > 0;
}

export async function unlinkTaskFromPage(
  pageId: string,
  taskId: string,
  userId: string
): Promise<void> {
  const [page] = await db
    .select({ id: pages.id })
    .from(pages)
    .where(and(eq(pages.id, pageId), eq(pages.userId, userId), isNull(pages.deletedAt)));

  if (!page) throw new NotFoundError("Page not found");

  await db
    .delete(taskPageLinks)
    .where(and(eq(taskPageLinks.pageId, pageId), eq(taskPageLinks.taskId, taskId)));
}

export async function getLinkedTasks(
  pageId: string,
  userId: string
): Promise<LinkedTask[]> {
  const [page] = await db
    .select({ id: pages.id })
    .from(pages)
    .where(and(eq(pages.id, pageId), eq(pages.userId, userId), isNull(pages.deletedAt)));

  if (!page) return [];

  return db
    .select({
      id: tasks.id,
      title: tasks.title,
      status: tasks.status,
      priority: tasks.priority,
      energyLevel: tasks.energyLevel,
      dueDate: tasks.dueDate,
      startDate: tasks.startDate,
      description: tasks.description,
      taskType: tasks.taskType,
      estimatedTime: tasks.estimatedTime,
      folderId: tasks.folderId,
      systemId: tasks.systemId,
      parentTaskId: tasks.parentTaskId,
    })
    .from(taskPageLinks)
    .innerJoin(tasks, eq(taskPageLinks.taskId, tasks.id))
    .where(
      and(
        eq(taskPageLinks.pageId, pageId),
        eq(tasks.userId, userId),
        isNull(tasks.deletedAt)
      )
    );
}

// ── page tags ──

export async function getPageTagsList(
  pageId: string,
  userId: string
): Promise<ContextTagListItem[]> {
  const [page] = await db
    .select({ id: pages.id })
    .from(pages)
    .where(and(eq(pages.id, pageId), eq(pages.userId, userId), isNull(pages.deletedAt)));
  if (!page) return [];

  return db
    .select({
      id: contextTags.id,
      title: contextTags.title,
      color: contextTags.color,
      systemId: contextTags.systemId,
      isDefault: contextTags.isDefault,
    })
    .from(pageTags)
    .innerJoin(contextTags, eq(pageTags.tagId, contextTags.id))
    .where(eq(pageTags.pageId, pageId));
}

export async function addTagToPage(
  pageId: string,
  tagId: string,
  userId: string
): Promise<boolean> {
  const [page] = await db
    .select({ id: pages.id })
    .from(pages)
    .where(and(eq(pages.id, pageId), eq(pages.userId, userId), isNull(pages.deletedAt)));
  if (!page) throw new NotFoundError("Page not found");

  const [tag] = await db
    .select({ id: contextTags.id })
    .from(contextTags)
    .where(and(eq(contextTags.id, tagId), eq(contextTags.userId, userId)));
  if (!tag) throw new NotFoundError("Tag not found");

  const inserted = await db
    .insert(pageTags)
    .values({ pageId, tagId })
    .onConflictDoNothing()
    .returning({ pageId: pageTags.pageId });

  return inserted.length > 0;
}

export async function removeTagFromPage(
  pageId: string,
  tagId: string,
  userId: string
): Promise<void> {
  const [page] = await db
    .select({ id: pages.id })
    .from(pages)
    .where(and(eq(pages.id, pageId), eq(pages.userId, userId), isNull(pages.deletedAt)));
  if (!page) throw new NotFoundError("Page not found");

  await db
    .delete(pageTags)
    .where(and(eq(pageTags.pageId, pageId), eq(pageTags.tagId, tagId)));
}
