import { beforeEach, describe, expect, it, vi } from 'vitest';
import { APIError } from 'better-auth/api';
import { NotFoundError, ValidationError } from '@/shared/utils/error';

const calls: string[] = [];

const authApi = vi.hoisted(() => ({
  signOut: vi.fn(),
  changePassword: vi.fn(),
  changeEmail: vi.fn(),
}));
vi.mock('@/auth', () => ({ auth: { api: authApi } }));

const queries = vi.hoisted(() => ({
  selectUserAccount: vi.fn(),
  selectSignInMethods: vi.fn(),
  updateUserName: vi.fn(),
  selectActiveSessions: vi.fn(),
  deleteSessionById: vi.fn(),
  deleteSessionsExcept: vi.fn(),
  deleteUserRow: vi.fn(),
}));
vi.mock('./account.queries', () => queries);

const getImageStorage = vi.hoisted(() => vi.fn());
vi.mock('@/features/uploads/image-storage', () => ({ getImageStorage }));

const deleteAllUserImages = vi.hoisted(() => vi.fn());
vi.mock('@/features/uploads/image-sweep', () => ({ deleteAllUserImages }));

const {
  changePassword,
  deleteAccount,
  getAccountOverview,
  listActiveSessions,
  revokeSession,
} = await import('./account.service');

const USER = 'user-1';
const HEADERS = new Headers({ cookie: 'session=abc' });
const STORAGE = { fake: true };

beforeEach(() => {
  calls.length = 0;
  vi.clearAllMocks();
  queries.selectUserAccount.mockResolvedValue({ name: 'Elias', email: 'Elias@Kino.dev', emailVerified: true });
  getImageStorage.mockReturnValue(STORAGE);
  deleteAllUserImages.mockImplementation(async () => {
    calls.push('images');
    return 2;
  });
  authApi.signOut.mockImplementation(async () => {
    calls.push('signOut');
    return { headers: new Headers({ 'set-cookie': 'session=; Max-Age=0' }), response: { success: true } };
  });
  queries.deleteUserRow.mockImplementation(async () => {
    calls.push('deleteUser');
  });
});

describe('deleteAccount', () => {
  it('borra imágenes, cierra sesión y por último la fila del usuario', async () => {
    const headers = await deleteAccount({ userId: USER, confirmation: 'elias@kino.dev', headers: HEADERS });

    expect(calls).toEqual(['images', 'signOut', 'deleteUser']);
    expect(deleteAllUserImages).toHaveBeenCalledWith(STORAGE, USER);
    expect(queries.deleteUserRow).toHaveBeenCalledWith(USER);
    expect(headers.get('set-cookie')).toContain('Max-Age=0');
  });

  it('no toca nada si el correo escrito no coincide', async () => {
    await expect(
      deleteAccount({ userId: USER, confirmation: 'otro@kino.dev', headers: HEADERS }),
    ).rejects.toBeInstanceOf(ValidationError);

    expect(calls).toEqual([]);
  });

  it('sin store de imágenes configurado sigue adelante con el resto', async () => {
    getImageStorage.mockReturnValue(null);

    await deleteAccount({ userId: USER, confirmation: 'elias@kino.dev', headers: HEADERS });

    expect(deleteAllUserImages).not.toHaveBeenCalled();
    expect(calls).toEqual(['signOut', 'deleteUser']);
  });

  it('si el barrido de imágenes falla, la cuenta queda intacta', async () => {
    deleteAllUserImages.mockRejectedValue(new Error('blob caído'));

    await expect(
      deleteAccount({ userId: USER, confirmation: 'elias@kino.dev', headers: HEADERS }),
    ).rejects.toThrow('blob caído');

    expect(authApi.signOut).not.toHaveBeenCalled();
    expect(queries.deleteUserRow).not.toHaveBeenCalled();
  });
});

describe('getAccountOverview', () => {
  it('detecta la contraseña y separa los proveedores OAuth', async () => {
    queries.selectSignInMethods.mockResolvedValue([
      { providerId: 'credential', hasPassword: true },
      { providerId: 'google', hasPassword: false },
    ]);

    const overview = await getAccountOverview(USER);

    expect(overview.hasPassword).toBe(true);
    expect(overview.providers).toEqual(['google']);
    expect(overview.email).toBe('Elias@Kino.dev');
  });

  it('una cuenta sólo de GitHub no tiene contraseña', async () => {
    queries.selectSignInMethods.mockResolvedValue([{ providerId: 'github', hasPassword: false }]);

    const overview = await getAccountOverview(USER);

    expect(overview.hasPassword).toBe(false);
    expect(overview.providers).toEqual(['github']);
  });
});

describe('sesiones', () => {
  it('marca cuál es la sesión actual y describe el dispositivo', async () => {
    const now = new Date();
    queries.selectActiveSessions.mockResolvedValue([
      { id: 's1', createdAt: now, updatedAt: now, ipAddress: '1.1.1.1', userAgent: 'Mozilla/5.0 (Windows NT 10.0) Chrome/128.0 Safari/537.36' },
      { id: 's2', createdAt: now, updatedAt: now, ipAddress: null, userAgent: null },
    ]);

    const list = await listActiveSessions(USER, 's2');

    expect(list.map((s) => s.current)).toEqual([false, true]);
    expect(list[0]!.device).toEqual({ browser: 'Chrome', os: 'Windows', mobile: false });
  });

  it('no deja cerrar la sesión actual por esta vía', async () => {
    await expect(revokeSession(USER, 's1', 's1')).rejects.toBeInstanceOf(ValidationError);
    expect(queries.deleteSessionById).not.toHaveBeenCalled();
  });

  it('una sesión ajena o inexistente es un 404', async () => {
    queries.deleteSessionById.mockResolvedValue(false);
    await expect(revokeSession(USER, 's9', 's1')).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('changePassword', () => {
  it('traduce la contraseña incorrecta a un error de validación legible', async () => {
    authApi.changePassword.mockRejectedValue(
      new APIError('BAD_REQUEST', { code: 'INVALID_PASSWORD', message: 'Invalid password' }),
    );

    await expect(
      changePassword(HEADERS, { currentPassword: 'mala', newPassword: 'nueva-segura' }),
    ).rejects.toThrow('La contraseña actual no es correcta');
  });

  it('siempre cierra las demás sesiones y devuelve las cabeceras de la cookie nueva', async () => {
    const out = new Headers({ 'set-cookie': 'session=nueva' });
    authApi.changePassword.mockResolvedValue({ headers: out, response: { token: 'nueva' } });

    const headers = await changePassword(HEADERS, { currentPassword: 'vieja', newPassword: 'nueva-segura' });

    expect(authApi.changePassword).toHaveBeenCalledWith(
      expect.objectContaining({ body: expect.objectContaining({ revokeOtherSessions: true }) }),
    );
    expect(headers).toBe(out);
  });
});
