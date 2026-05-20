import { db } from "@/shared/db";
import { pages, tasks, taskPageLinks, folders } from "@/shared/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { NotFoundError, ForbiddenError } from "@/shared/utils/error";
import type { CreatePageInput, UpdatePageInput } from "./pages.schemas";
import type { PageDetail, PageListItem, LinkedTask } from "./pages.types";

export async function getPagesBySystem(
  systemId: string,
  userId: string
): Promise<PageListItem[]> {
  return db
    .select({
      id: pages.id,
      title: pages.title,
      folderId: pages.folderId,
      systemId: pages.systemId,
      isPinned: pages.isPinned,
      createdAt: pages.createdAt,
      updatedAt: pages.updatedAt,
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

  const [created] = await db
    .insert(pages)
    .values({
      userId,
      systemId: input.systemId,
      folderId: input.folderId ?? null,
      title: input.title ?? null,
    })
    .returning({
      id: pages.id,
      title: pages.title,
      folderId: pages.folderId,
      systemId: pages.systemId,
      isPinned: pages.isPinned,
      createdAt: pages.createdAt,
      updatedAt: pages.updatedAt,
    });

  return created!;
}

export async function updatePage(
  pageId: string,
  userId: string,
  data: UpdatePageInput
): Promise<PageListItem | null> {
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
      createdAt: pages.createdAt,
      updatedAt: pages.updatedAt,
    });

  return updated ?? null;
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
