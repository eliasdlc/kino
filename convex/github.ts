'use node';

import { v } from 'convex/values';
import { internal } from './_generated/api';
import { fetchIssues, fetchRepoFullName, fetchViewerLogin } from '../src/features/github-sync/github-sync.client';
import { GithubApiError, type GithubConnectionStatus, type SyncResult } from '../src/features/github-sync/github-sync.types';
import { decryptSecret, encryptSecret, isEncryptionConfigured } from '../src/shared/utils/crypto';
import { invalid } from './lib/errors';
import { kinoAction } from './lib/fn';

// Lo que habla con GitHub. Corre en Node por el cifrado del token; cada
// acción lleva su presupuesto escrito y escribe por las mutaciones internas de
// `githubData.ts`, que son las que tocan la base en una transacción.

const GITHUB_BUDGET_MS = 8_000;

// Los resultados de las funciones internas van anotados a mano: el tipo de
// `internal` incluye este mismo módulo y sin la anotación el compilador cicla.
type StoredConnection = { accessTokenEncrypted: string; lastSyncedAt: number | null } | null;
type SystemForSync = { id: string; metadata: Record<string, unknown> | null; repo: { owner: string; repo: string } | null };

/** Estado de la conexión, con el login comprobado contra GitHub. */
export const status = kinoAction(GITHUB_BUDGET_MS)({
  args: {},
  handler: async (ctx): Promise<GithubConnectionStatus & { configured: boolean }> => {
    const stored: StoredConnection = await ctx.runQuery(internal.githubData.connectionOf, { userId: ctx.user._id });
    const configured = isEncryptionConfigured();
    if (!stored) return { connected: false, login: null, lastSyncedAt: null, revoked: false, configured };
    const lastSyncedAt = stored.lastSyncedAt === null ? null : new Date(stored.lastSyncedAt).toISOString();
    try {
      const login = await fetchViewerLogin(decryptSecret(stored.accessTokenEncrypted));
      return { connected: true, login, lastSyncedAt, revoked: false, configured };
    } catch (error) {
      // Un token revocado no rompe Ajustes: se ofrece reconectar.
      if (error instanceof GithubApiError && error.unauthorized) return { connected: true, login: null, lastSyncedAt, revoked: true, configured };
      throw error;
    }
  },
});

/** Guarda el token cifrado tras comprobarlo contra GitHub. Lo llama la vuelta del OAuth. */
export const connect = kinoAction(GITHUB_BUDGET_MS)({
  args: { accessToken: v.string(), refreshToken: v.union(v.string(), v.null()) },
  handler: async (ctx, { accessToken, refreshToken }): Promise<null> => {
    if (!isEncryptionConfigured()) invalid('Falta ENCRYPTION_KEY en el entorno: sin ella no se puede guardar el token cifrado.');
    await fetchViewerLogin(accessToken);
    await ctx.runMutation(internal.githubData.saveConnection, {
      userId: ctx.user._id,
      accessTokenEncrypted: encryptSecret(accessToken),
      refreshTokenEncrypted: refreshToken ? encryptSecret(refreshToken) : undefined,
    });
    return null;
  },
});


/** Enlaza un repositorio, comprobando antes que existe y es accesible. */
export const linkRepo = kinoAction(GITHUB_BUDGET_MS)({
  args: { id: v.id('systems'), owner: v.string(), repo: v.string() },
  handler: async (ctx, { id, owner, repo }): Promise<{ fullName: string }> => {
    const stored: StoredConnection = await ctx.runQuery(internal.githubData.connectionOf, { userId: ctx.user._id });
    if (!stored) invalid('No hay ninguna cuenta de GitHub conectada. Conéctala en Ajustes.');
    await ctx.runQuery(internal.githubData.systemForSync, { userId: ctx.user._id, systemId: id });
    const fullName = await fetchRepoFullName({ owner, repo }, decryptSecret(stored.accessTokenEncrypted));
    await ctx.runMutation(internal.githubData.linkRepoMeta, { userId: ctx.user._id, systemId: id, owner, repo });
    return { fullName };
  },
});

/** Trae los issues del repositorio enlazado y los refleja en el tablero. */
export const sync = kinoAction(GITHUB_BUDGET_MS)({
  args: { id: v.id('systems') },
  handler: async (ctx, { id }): Promise<SyncResult> => {
    const system: SystemForSync = await ctx.runQuery(internal.githubData.systemForSync, { userId: ctx.user._id, systemId: id });
    if (!system.repo) invalid('Este sistema no tiene ningún repositorio enlazado.');
    const stored: StoredConnection = await ctx.runQuery(internal.githubData.connectionOf, { userId: ctx.user._id });
    if (!stored) invalid('No hay ninguna cuenta de GitHub conectada. Conéctala en Ajustes.');
    const { issues, truncated } = await fetchIssues(system.repo, decryptSecret(stored.accessTokenEncrypted));
    return ctx.runMutation(internal.githubData.applySync, { userId: ctx.user._id, systemId: id, issues, truncated });
  },
});
