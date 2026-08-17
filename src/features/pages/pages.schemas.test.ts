import { describe, expect, it } from 'vitest';
import { updatePageSchema } from './pages.schemas';

describe('updatePageSchema', () => {
  it('turns the expected page version into a Date for the database condition', () => {
    const parsed = updatePageSchema.parse({
      content: '<p>Updated</p>',
      expectedUpdatedAt: '2026-08-17T08:00:00-04:00',
    });

    expect(parsed.expectedUpdatedAt).toEqual(new Date('2026-08-17T12:00:00.000Z'));
  });

  it('keeps existing editor updates backward compatible', () => {
    expect(updatePageSchema.parse({ title: 'New title' })).toEqual({ title: 'New title' });
  });
});
