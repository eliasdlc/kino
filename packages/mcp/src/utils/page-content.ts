import { z } from 'zod';
import { htmlToMarkdown } from './markdown.js';

const storedPageSchema = z.object({
  content: z.string().nullable(),
  updatedAt: z.string(),
}).passthrough();

export type StoredPage = z.infer<typeof storedPageSchema>;

export function parseStoredPage(input: unknown): StoredPage {
  return storedPageSchema.parse(input);
}

export function pageAsMarkdown(input: unknown) {
  const page = parseStoredPage(input);
  return {
    ...page,
    content: htmlToMarkdown(page.content),
    contentFormat: 'markdown' as const,
  };
}

export function assertPageVersion(page: StoredPage, expectedUpdatedAt: string): void {
  if (Date.parse(page.updatedAt) !== Date.parse(expectedUpdatedAt)) {
    throw new Error(
      `Page changed after ${expectedUpdatedAt}. Read it again and apply the change to version ${page.updatedAt}.`,
    );
  }
}

export function appendMarkdown(current: string | null, addition: string): string {
  const next = addition.trim();
  if (!current?.trim()) return next;
  return `${current.trimEnd()}\n\n${next}`;
}
