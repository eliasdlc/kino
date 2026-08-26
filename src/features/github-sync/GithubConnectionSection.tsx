"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { GitBranch, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
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
  const { data, isLoading } = useGithubConnection();
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
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">GitHub</h2>
        <p className="text-sm text-muted-foreground">
          Conecta tu cuenta para traer los issues de un repositorio al board de un
          sistema de tipo proyecto. Kino sólo lee: nunca escribe en GitHub.
        </p>
      </div>

      <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
        <div className="flex min-w-0 items-center gap-3">
          <GitBranch className="size-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 space-y-0.5">
            <Label className="text-sm font-medium">Cuenta conectada</Label>
            {isLoading ? (
              <Skeleton className="h-4 w-40" />
            ) : !data?.configured ? (
              <p className="text-xs text-muted-foreground">
                Este despliegue no tiene configurada la integración.
              </p>
            ) : data.revoked ? (
              <p className="flex items-center gap-1.5 text-xs text-destructive">
                <TriangleAlert className="size-3.5 shrink-0" />
                GitHub rechazó el token. Vuelve a conectar.
              </p>
            ) : data.connected ? (
              <p className="truncate text-xs text-muted-foreground">
                {data.login ? `@${data.login}` : "Conectada"}
                {data.lastSyncedAt
                  ? ` · última sincronización ${new Date(data.lastSyncedAt).toLocaleString()}`
                  : " · sin sincronizar todavía"}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">Ninguna</p>
            )}
          </div>
        </div>

        {isLoading ? (
          <Skeleton className="h-9 w-28 shrink-0 rounded-md" />
        ) : !data?.configured ? null : data.connected ? (
          <div className="flex shrink-0 gap-2">
            {data.revoked && (
              <Button asChild size="sm">
                {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- `/api/...` no es una página: es el endpoint que redirige a GitHub, y necesita navegación real. La regla lo confunde desde que existe el catch-all del contrato. */}
                <a href="/api/integrations/github/connect?returnTo=/settings">
                  Reconectar
                </a>
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              disabled={isPending}
              onClick={() => setConfirmOpen(true)}
            >
              Desconectar
            </Button>
          </div>
        ) : (
          <Button asChild size="sm" className="shrink-0">
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- Mismo caso que arriba: endpoint de redirección, no página. */}
            <a href="/api/integrations/github/connect?returnTo=/settings">
              Conectar
            </a>
          </Button>
        )}
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
