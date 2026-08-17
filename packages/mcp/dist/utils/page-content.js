import { z } from 'zod';
import { htmlToMarkdown } from './markdown.js';
const storedPageSchema = z.object({
    content: z.string().nullable(),
    updatedAt: z.string(),
}).passthrough();
export function parseStoredPage(input) {
    return storedPageSchema.parse(input);
}
export function pageAsMarkdown(input) {
    const page = parseStoredPage(input);
    return {
        ...page,
        content: htmlToMarkdown(page.content),
        contentFormat: 'markdown',
    };
}
export function assertPageVersion(page, expectedUpdatedAt) {
    if (Date.parse(page.updatedAt) !== Date.parse(expectedUpdatedAt)) {
        throw new Error(`Page changed after ${expectedUpdatedAt}. Read it again and apply the change to version ${page.updatedAt}.`);
    }
}
export function appendMarkdown(current, addition) {
    const next = addition.trim();
    if (!current?.trim())
        return next;
    return `${current.trimEnd()}\n\n${next}`;
}
