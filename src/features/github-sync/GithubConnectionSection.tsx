"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { GitBranch, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useDisconnectGithub, useGithubConnection } from "./github-sync.hooks";

/**
 * Sección de Ajustes para la cuenta de GitHub (KIN-135).
 *
 * La conexión es una por usuario; qué repositorio mira cada board se declara
 * dentro del sistema, no aquí.
 */
export function GithubConnectionSection() {
  const { data, isLoading, error } = useGithubConnection();
  const { mutate: disconnect, isPending } = useDisconnectGithub();
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const params = useSearchParams();

  // El callback de OAuth vuelve por un redirect, así que el resultado llega en
  // la URL y no como respuesta de un fetch.
  const resultado = params.get("github");
  React.useEffect(() => {
    if (resultado === "connected") toast.success("Cuenta de GitHub conectada.");
    if (resultado === "error") {
      toast.error("No se pudo conectar la cuenta de GitHub.");
    }
  }, [resultado]);

  return (
    <div className="space-y-3">
      {/* Sin caja: la hoja de Conexiones ya es el grupo, y esta fuente es una
          fila de su lista, con el peso de las filas de Ajustes. El nombre
          sigue siendo un encabezado para quien navega la hoja por títulos,
          pero se pinta como el título de una fila y no como una sección. */}
      <div className="flex items-start gap-3">
        <GitBranch aria-hidden className="mt-[0.2rem] size-5 shrink-0 stroke-[1.8] text-muted-foreground" />
        <div className="min-w-0 space-y-1">
          <h3 className="text-base leading-6 font-semibold text-foreground">GitHub</h3>
          <p className="text-sm leading-5 text-muted-foreground">
            Conecta tu cuenta para traer los issues de un repositorio al tablero de
            un sistema de tipo proyecto. Sólo se lee: nada se escribe en GitHub.
          </p>
          <div className="text-sm leading-5" aria-live="polite">
            {isLoading ? (
              <Skeleton className="h-4 w-40" />
            ) : error ? (
              // Sin esta rama, un fallo al preguntar por la conexión se leía
              // como «este despliegue no tiene la integración», que es otra cosa.
              <p className="flex items-center gap-1.5 text-destructive">
                <TriangleAlert aria-hidden className="size-4 shrink-0" />
                No se pudo comprobar la cuenta. Vuelve a cargar la página.
              </p>
            ) : !data?.configured ? (
              <p className="text-muted-foreground">Este despliegue no tiene configurada la integración.</p>
            ) : data.revoked ? (
              <p className="flex items-center gap-1.5 text-destructive">
                <TriangleAlert aria-hidden className="size-4 shrink-0" />
                GitHub rechazó el token. Vuelve a conectar.
              </p>
            ) : data.connected ? (
              <p className="text-foreground">
                {data.login ? `Conectada como @${data.login}` : "Conectada"}
                <span className="text-muted-foreground">
                  {data.lastSyncedAt
                    ? `, última sincronización ${new Date(data.lastSyncedAt).toLocaleString()}`
                    : ", sin sincronizar todavía"}
                </span>
              </p>
            ) : (
              <p className="text-muted-foreground">Sin cuenta conectada.</p>
            )}
          </div>

          {isLoading ? (
            <Skeleton className="mt-2 h-[2.85rem] w-32 rounded-full md:pointer-fine:h-10" />
          ) : error || !data?.configured ? null : (
            <div className="flex flex-wrap gap-2 pt-1">
              {data.connected ? (
                <>
                  {data.revoked && (
                    <Button asChild size="sm">
                      {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- `/api/...` no es una página: es el endpoint que redirige a GitHub, y necesita navegación real. La regla lo confunde desde que existe el catch-all del contrato. */}
                      <a href="/api/integrations/github/connect?returnTo=/settings">Reconectar</a>
                    </Button>
                  )}
                  <Button variant="outline" size="sm" disabled={isPending} onClick={() => setConfirmOpen(true)}>
                    {isPending ? "Desconectando" : "Desconectar"}
                  </Button>
                </>
              ) : (
                <Button asChild size="sm">
                  {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- Mismo caso que arriba: endpoint de redirección, no página. */}
                  <a href="/api/integrations/github/connect?returnTo=/settings">Conectar</a>
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="¿Desconectar GitHub?"
        description="Los boards dejarán de sincronizarse. Las tarjetas ya importadas se quedan como están, con lo que les añadiste en Kino."
        onConfirm={() => {
          setConfirmOpen(false);
          disconnect(undefined, {
            onSuccess: () => toast.success("Cuenta desconectada."),
            onError: (e) => toast.error(e.message),
          });
        }}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
