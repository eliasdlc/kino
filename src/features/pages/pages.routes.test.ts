import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { ConflictError } from '@/shared/utils/error';

const getAuthContext = vi.hoisted(() => vi.fn());
vi.mock('@/shared/utils/auth-context', () => ({ getAuthContext }));

const service = vi.hoisted(() => ({
  getPagesBySystem: vi.fn(),
  createPage: vi.fn(),
  getPageById: vi.fn(),
  updatePage: vi.fn(),
  deletePage: vi.fn(),
  linkTaskToPage: vi.fn(),
  unlinkTaskFromPage: vi.fn(),
  getLinkedTasks: vi.fn(),
}));
vi.mock('./pages.service', () => service);

const { patchPage } = await import('./pages.routes');

const USER_ID = '9c1d4f6a-2b3e-4a8c-9d5f-7e0a1b2c3d4e';
const PAGE_ID = '7b8c9d0e-1f2a-4b3c-8d4e-5f6a7b8c9d0e';
const VERSION = '2026-08-17T12:00:00.000Z';
const params = { params: Promise.resolve({ id: PAGE_ID }) };

function patch(body: unknown) {
  return new NextRequest(`http://localhost/api/pages/${PAGE_ID}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  getAuthContext.mockResolvedValue({ userId: USER_ID });
});

describe('page version conflict contract', () => {
  it('passes the expected page version to the service as a Date', async () => {
    service.updatePage.mockResolvedValue({ id: PAGE_ID, content: '<p>Updated</p>' });

    const response = await patchPage(
      patch({ content: '<p>Updated</p>', expectedUpdatedAt: VERSION }),
      params,
    );

    expect(response.status).toBe(200);
    expect(service.updatePage).toHaveBeenCalledWith(
      PAGE_ID,
      USER_ID,
      { content: '<p>Updated</p>', expectedUpdatedAt: new Date(VERSION) },
    );
  });

  it('returns 409 instead of overwriting when the version is stale', async () => {
    service.updatePage.mockRejectedValue(
      new ConflictError('Page changed since it was read. Fetch the latest version before saving.'),
    );

    const response = await patchPage(
      patch({ content: '<p>Stale</p>', expectedUpdatedAt: VERSION }),
      params,
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      code: 'CONFLICT',
      message: 'Page changed since it was read. Fetch the latest version before saving.',
    });
  });
});
