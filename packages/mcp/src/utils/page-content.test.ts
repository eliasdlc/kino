import { describe, expect, it } from 'vitest';
import {
  appendMarkdown,
  assertPageVersion,
  pageAsMarkdown,
  parseStoredPage,
} from './page-content.js';

const storedPage = {
  id: 'page-1',
  content: '<h1>Topic</h1><p>Start here.</p>',
  updatedAt: '2026-08-17T12:00:00.000Z',
};

describe('MCP page version contract', () => {
  it('returns page content as Markdown with an explicit format', () => {
    expect(pageAsMarkdown(storedPage)).toMatchObject({
      id: 'page-1',
      content: '# Topic\n\nStart here.',
      contentFormat: 'markdown',
    });
  });

  it('accepts the version that was read and rejects a stale version', () => {
    const page = parseStoredPage(storedPage);
    expect(() => assertPageVersion(page, '2026-08-17T08:00:00-04:00')).not.toThrow();
    expect(() => assertPageVersion(page, '2026-08-17T11:59:59.000Z')).toThrow(
      'Page changed after',
    );
  });

  it('appends with one stable Markdown boundary', () => {
    expect(appendMarkdown('# Topic\n', '  New evidence  ')).toBe('# Topic\n\nNew evidence');
    expect(appendMarkdown(null, '  First entry  ')).toBe('First entry');
  });
});
