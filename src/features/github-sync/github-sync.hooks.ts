"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { taskKeys } from "@/features/tasks/tasks.keys";
import { sprintKeys } from "@/features/sprints/sprints.hooks";
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

/** Mensaje del backend, que ya viene redactado para enseñarlo tal cual. */
async function readError(res: Response, fallback: string): Promise<never> {
  const body = (await res.json().catch(() => null)) as {
    message?: string;
  } | null;
  throw new Error(body?.message ?? fallback);
}

export function useGithubConnection() {
  return useQuery<ConnectionStatusResponse>({
    queryKey: githubKeys.connection,
    queryFn: async () => {
      const res = await fetch("/api/integrations/github");
      if (!res.ok) return readError(res, "No se pudo leer la conexión con GitHub");
      return res.json();
    },
    staleTime: 60_000,
  });
}

export function useDisconnectGithub() {
  const qc = useQueryClient();
  return useMutation<void, Error, void>({
    mutationFn: async () => {
      const res = await fetch("/api/integrations/github", { method: "DELETE" });
      if (!res.ok) return readError(res, "No se pudo desconectar");
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
      const res = await fetch(`/api/systems/${systemId}/github/link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) return readError(res, "No se pudo enlazar el repositorio");
      return res.json();
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
      const res = await fetch(`/api/systems/${systemId}/github/link`, {
        method: "DELETE",
      });
      if (!res.ok) return readError(res, "No se pudo desenlazar el repositorio");
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
      const res = await fetch(`/api/systems/${systemId}/github/sync`, {
        method: "POST",
      });
      if (!res.ok) return readError(res, "No se pudo sincronizar con GitHub");
      return res.json();
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
