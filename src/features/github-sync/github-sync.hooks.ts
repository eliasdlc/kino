"use client";

import { api } from "@convex/_generated/api";
import { useConvexAction, useConvexMutation } from "@/shared/convex/hooks";
import { useEffect, useState } from "react";
import { useAction, useConvexAuth } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import type { GithubRepoRef, SyncResult } from "./github-sync.types";

export type ConnectionStatusResponse = FunctionReturnType<typeof api.github.status>;

/**
 * El estado de la conexión sale de una acción (habla con GitHub para validar el
 * token), así que no es una suscripción: se pide al montar y tras cada cambio.
 */
export function useGithubConnection() {
  const status = useAction(api.github.status);
  const { isAuthenticated } = useConvexAuth();
  const [data, setData] = useState<ConnectionStatusResponse | undefined>(undefined);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    // Sin el token de Clerk todavía, la acción se rechazaría como anónima.
    if (!isAuthenticated) return;
    let alive = true;
    void status({}).then((result) => {
      if (alive) setData(result);
    });
    return () => {
      alive = false;
    };
  }, [status, version, isAuthenticated]);
  return { data, isLoading: data === undefined, refetch: async () => setVersion((v) => v + 1) };
}

export function useDisconnectGithub() {
  return useConvexMutation(api.githubData.disconnect);
}

export function useLinkRepo(systemId: string) {
  return useConvexAction(api.github.linkRepo, {
    map: ({ fullName }: { fullName: string }) => {
      const [owner, repo] = fullName.split('/');
      return { id: systemId, owner: owner ?? '', repo: repo ?? '' };
    },
  });
}

export function useUnlinkRepo(systemId: string) {
  return useConvexMutation(api.githubData.unlinkRepo, { map: () => ({ id: systemId }) });
}

/** Dispara la sincronización. Las tareas y sprints del board llegan solos por suscripción. */
export function useSyncGithub(systemId: string) {
  return useConvexAction(api.github.sync, { map: () => ({ id: systemId }) });
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
