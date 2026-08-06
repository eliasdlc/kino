import { beforeEach, describe, expect, it, vi } from 'vitest';

// Las queries importan la conexión a la base; se mockean para probar solo el
// reparto del presupuesto entre usuarios y el aislamiento de fallos.
vi.mock('./uploads.queries', () => ({
  getReferencedImageUrls: vi.fn(),
  getAllUserIds: vi.fn(),
}));

vi.mock('./image-storage', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./image-storage')>()),
  getImageStorage: vi.fn(),
}));

vi.mock('./image-sweep', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./image-sweep')>()),
  sweepUserImages: vi.fn(),
}));

import * as queries from './uploads.queries';
import { getImageStorage, type ImageStorage } from './image-storage';
import { sweepUserImages } from './image-sweep';
import { sweepOrphanImagesForUser, sweepOrphanImagesForAllUsers } from './uploads.service';

const q = vi.mocked(queries);
const storageOf = vi.mocked(getImageStorage);
const sweep = vi.mocked(sweepUserImages);

const FAKE_STORAGE = {} as ImageStorage;

function sweepResult(over: Partial<Awaited<ReturnType<typeof sweepUserImages>>> = {}) {
  return {
    scanned: 1,
    deleted: 1,
    freedBytes: 1_000,
    keptReferenced: 0,
    keptRecent: 0,
    incomplete: false,
    aborted: false,
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  storageOf.mockReturnValue(FAKE_STORAGE);
  q.getReferencedImageUrls.mockResolvedValue(new Set<string>());
  q.getAllUserIds.mockResolvedValue(['u1']);
  sweep.mockResolvedValue(sweepResult());
});

describe('sweepOrphanImagesForUser', () => {
  it('devuelve null sin store configurado, y no barre nada', async () => {
    storageOf.mockReturnValue(null);

    expect(await sweepOrphanImagesForUser('u1')).toBeNull();
    expect(sweep).not.toHaveBeenCalled();
  });

  it('lee las referencias antes de barrer', async () => {
    const orden: string[] = [];
    q.getReferencedImageUrls.mockImplementation(async () => {
      orden.push('referencias');
      return new Set<string>();
    });
    sweep.mockImplementation(async () => {
      orden.push('barrido');
      return sweepResult();
    });

    await sweepOrphanImagesForUser('u1');

    // Al revés, una imagen subida entre medias contaría como huérfana sin serlo.
    expect(orden).toEqual(['referencias', 'barrido']);
  });

  it('barre con las referencias de ese usuario', async () => {
    const refs = new Set(['https://x/a.webp']);
    q.getReferencedImageUrls.mockResolvedValue(refs);

    await sweepOrphanImagesForUser('u7');

    expect(sweep).toHaveBeenCalledWith(expect.objectContaining({ userId: 'u7', referenced: refs }));
  });
});

describe('sweepOrphanImagesForAllUsers', () => {
  it('sin store no toca la base de datos', async () => {
    storageOf.mockReturnValue(null);

    const res = await sweepOrphanImagesForAllUsers();

    expect(res).toEqual({ users: 0, deleted: 0, freedBytes: 0, incomplete: false, aborted: 0 });
    expect(q.getAllUserIds).not.toHaveBeenCalled();
  });

  it('suma lo borrado de todos los usuarios', async () => {
    q.getAllUserIds.mockResolvedValue(['u1', 'u2', 'u3']);
    sweep.mockResolvedValue(sweepResult({ deleted: 2, freedBytes: 500 }));

    const res = await sweepOrphanImagesForAllUsers();

    expect(res).toMatchObject({ users: 3, deleted: 6, freedBytes: 1_500, incomplete: false });
  });

  it('un usuario que falla no se lleva por delante a los demás', async () => {
    q.getAllUserIds.mockResolvedValue(['u1', 'u2', 'u3']);
    sweep
      .mockResolvedValueOnce(sweepResult({ deleted: 1 }))
      .mockRejectedValueOnce(new Error('store caído'))
      .mockResolvedValueOnce(sweepResult({ deleted: 1 }));

    const res = await sweepOrphanImagesForAllUsers();

    expect(res.users).toBe(3);
    expect(res.deleted).toBe(2);
    expect(res.incomplete).toBe(true);
  });

  it('propaga que un usuario quedó a medias', async () => {
    sweep.mockResolvedValue(sweepResult({ incomplete: true }));

    const res = await sweepOrphanImagesForAllUsers();

    expect(res.incomplete).toBe(true);
  });

  it('cuenta los usuarios cuyo barrido se frenó', async () => {
    q.getAllUserIds.mockResolvedValue(['u1', 'u2']);
    sweep
      .mockResolvedValueOnce(sweepResult({ aborted: true, deleted: 0 }))
      .mockResolvedValueOnce(sweepResult({ deleted: 3 }));

    const res = await sweepOrphanImagesForAllUsers();

    // Frenado no es lo mismo que a medias: repetir el cron no lo arregla.
    expect(res.aborted).toBe(1);
    expect(res.deleted).toBe(3);
  });

  it('para al agotarse el plazo y deja el resto para la siguiente vuelta', async () => {
    q.getAllUserIds.mockResolvedValue(['u1', 'u2', 'u3', 'u4']);
    let tick = 0;
    const now = () => (tick++) * 1_000;

    const res = await sweepOrphanImagesForAllUsers({ deadlineMs: 2_500, now });

    expect(res.users).toBeLessThan(4);
    expect(res.incomplete).toBe(true);
  });

  it('sin usuarios no hay nada que reportar', async () => {
    q.getAllUserIds.mockResolvedValue([]);

    const res = await sweepOrphanImagesForAllUsers();

    expect(res).toEqual({ users: 0, deleted: 0, freedBytes: 0, incomplete: false, aborted: 0 });
    expect(sweep).not.toHaveBeenCalled();
  });
});
