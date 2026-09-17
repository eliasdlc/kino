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
 *
 * El `catch` no es una precaución: sin él, una acción que falla (GitHub caído,
 * un 500, la red) deja `data` en `undefined` para siempre, `isLoading` no baja
 * nunca y quien la consume se queda esperando sin nada que enseñar.
 */
export function useGithubConnection() {
  const status = useAction(api.github.status);
  const { isAuthenticated } = useConvexAuth();
  const [data, setData] = useState<ConnectionStatusResponse | undefined>(undefined);
  const [error, setError] = useState<Error | null>(null);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    // Sin el token de Clerk todavía, la acción se rechazaría como anónima.
    if (!isAuthenticated) return;
    let alive = true;
    void status({})
      .then((result) => {
        if (!alive) return;
        setData(result);
        setError(null);
      })
      .catch((fallo: unknown) => {
        if (!alive) return;
        setData(undefined);
        setError(fallo instanceof Error ? fallo : new Error(String(fallo)));
      });
    return () => {
      alive = false;
    };
  }, [status, version, isAuthenticated]);
  return {
    data,
    error,
    isLoading: data === undefined && error === null,
    refetch: async () => {
      setError(null);
      setVersion((v) => v + 1);
    },
  };
}

export function useDisconnectGithub() {
  // Pasa por `connections`, que es el slice de las fuentes conectadas: olvidar
  // una conexión es la misma operación para todas, y el proveedor se valida
  // contra los que de verdad tienen código.
  return useConvexMutation(api.connections.forget, { map: () => ({ provider: 'github' as const }) });
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

/** Lo que distingue un refresco del otro. Sin él, el de cada día. */
export interface SyncGithubInput {
  /**
   * Ignora hasta dónde llegó el último refresco y vuelve a pedir el
   * repositorio desde el principio. Es la salida cuando el cursor se quedó por
   * detrás de issues que ya no vuelven solos.
   */
  refrescoCompleto?: boolean;
}

/** Dispara la sincronización. Las tareas y sprints del board llegan solos por suscripción. */
export function useSyncGithub(systemId: string) {
  return useConvexAction(api.github.sync, {
    // La clave sólo viaja cuando toca: así el refresco de cada día manda
    // exactamente los mismos argumentos que mandaba antes de que existiera el
    // completo.
    map: (input: SyncGithubInput | undefined) =>
      input?.refrescoCompleto ? { id: systemId, refrescoCompleto: true } : { id: systemId },
  });
}

/**
 * Texto del resultado, para el toast. Separado para poder probarlo aparte.
 *
 * Con la respuesta truncada el aviso dice qué hacer y por qué sirve: el cursor
 * se quedó en el último issue traído, así que el refresco siguiente sigue por
 * ahí. Antes aconsejaba sincronizar de nuevo cuando eso no traía nada, porque
 * el cursor había saltado por encima de los que faltaban.
 */
export function describeSyncResult(result: SyncResult): string {
  const partes: string[] = [];
  if (result.imported > 0) partes.push(`${result.imported} importada(s)`);
  if (result.updated > 0) partes.push(`${result.updated} actualizada(s)`);
  if (result.sprintsCreated > 0) {
    partes.push(`${result.sprintsCreated} sprint(s) nuevo(s)`);
  }

  const resumen = partes.join(" · ");

  if (result.truncated) {
    const cola = "Faltan issues por traer: sincroniza otra vez y sigue desde donde se quedó.";
    return resumen ? `${resumen}. ${cola}` : cola;
  }

  return resumen || "Todo estaba al día.";
}

export type { GithubRepoRef };
