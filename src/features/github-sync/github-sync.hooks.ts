"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { taskKeys } from "@/features/tasks/tasks.keys";
import { sprintKeys } from "@/features/sprints/sprints.hooks";
import { api } from "@/shared/api/client";
import type {
  GithubConnectionStatus,
  GithubRepoRef,
  SyncResult,
} from "./github-sync.types";

export interface ConnectionStatusResponse extends GithubConnectionStatus {
  /** false si el despliegue no tiene registrado el OAuth App de sincronización. */
  configured: boolean;
}

export const githubKeys = {
  connection: ["github", "connection"] as const,
};

export function useGithubConnection() {
  return useQuery({
    queryKey: githubKeys.connection,
    queryFn: async () => {
      return api.github.status({});
    },
    staleTime: 60_000,
  });
}

export function useDisconnectGithub() {
  const qc = useQueryClient();
  return useMutation<void, Error, void>({
    mutationFn: async () => {
      await api.github.disconnect({});
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: githubKeys.connection });
    },
  });
}

export function useLinkRepo(systemId: string) {
  const qc = useQueryClient();
  return useMutation<{ fullName: string }, Error, { fullName: string }>({
    mutationFn: async (body) => {
      return api.github.linkRepo({ ...body, id: systemId });
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["systems"] });
    },
  });
}

export function useUnlinkRepo(systemId: string) {
  const qc = useQueryClient();
  return useMutation<void, Error, void>({
    mutationFn: async () => {
      await api.github.unlinkRepo({ id: systemId });
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["systems"] });
    },
  });
}

/**
 * Dispara la sincronización y refresca el board.
 *
 * Sin mutación optimista a propósito, que es la excepción a la regla del repo:
 * el resultado depende de lo que devuelva GitHub, así que no hay nada que
 * adelantar — pintar tarjetas que quizá no existan sería mentir.
 */
export function useSyncGithub(systemId: string) {
  const qc = useQueryClient();
  return useMutation<SyncResult, Error, void>({
    mutationFn: async () => {
      return api.github.sync({ id: systemId });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: taskKeys.bySystem(systemId) });
      qc.invalidateQueries({ queryKey: sprintKeys.bySystem(systemId) });
      qc.invalidateQueries({ queryKey: githubKeys.connection });
    },
  });
}

/** Texto del resultado, para el toast. Separado para poder probarlo aparte. */
export function describeSyncResult(result: SyncResult): string {
  const partes: string[] = [];
  if (result.imported > 0) partes.push(`${result.imported} importada(s)`);
  if (result.updated > 0) partes.push(`${result.updated} actualizada(s)`);
  if (result.sprintsCreated > 0) {
    partes.push(`${result.sprintsCreated} sprint(s) nuevo(s)`);
  }

  if (partes.length === 0) return "Todo estaba al día.";

  const resumen = partes.join(" · ");
  return result.truncated
    ? `${resumen}. Quedaron issues sin traer: vuelve a sincronizar.`
    : resumen;
}

export type { GithubRepoRef };
