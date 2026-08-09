"use client";

import * as React from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { SystemMetadata } from "@/shared/lib/system-types";
import { GithubRepoPanelView, type RepoPanelState } from "./GithubRepoPanelView";
import {
  describeSyncResult,
  useGithubConnection,
  useLinkRepo,
  useSyncGithub,
  useUnlinkRepo,
} from "./github-sync.hooks";

interface GithubRepoPanelProps {
  systemId: string;
  metadata: SystemMetadata | null;
}

/**
 * Panel del board para enlazar el repositorio y refrescar (KIN-135).
 *
 * Sólo lo monta la vista `project`: el resto de arquetipos no ve nada de esta
 * integración, que es uno de los criterios de aceptación del ticket. Lo visible
 * vive en `GithubRepoPanelView`; aquí sólo están los datos.
 */
export function GithubRepoPanel({ systemId, metadata }: GithubRepoPanelProps) {
  const { data: connection, isLoading } = useGithubConnection();
  const { mutate: link, isPending: linking } = useLinkRepo(systemId);
  const { mutate: unlink } = useUnlinkRepo(systemId);
  const { mutate: sync, isPending: syncing } = useSyncGithub(systemId);

  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const repo = metadata?.github;

  const puedeSincronizar =
    Boolean(repo) && Boolean(connection?.connected) && !connection?.revoked;

  /**
   * Refresco bajo demanda al abrir el board, no por cron: la única entrada de
   * cron del free tier de Vercel está ocupada, y bajo demanda es más barato y
   * suficiente para validar si el feature se usa. El ref evita que un segundo
   * render — o el doble montaje de React en desarrollo — dispare dos veces.
   */
  const yaSincronizado = React.useRef(false);
  React.useEffect(() => {
    if (!puedeSincronizar || yaSincronizado.current) return;
    yaSincronizado.current = true;
    sync();
  }, [puedeSincronizar, sync]);

  if (isLoading || !connection?.configured) return null;

  const state: RepoPanelState = !connection.connected
    ? { kind: "disconnected" }
    : repo
      ? { kind: "linked", repo, revoked: connection.revoked }
      : { kind: "unlinked" };

  return (
    <>
      <GithubRepoPanelView
        state={state}
        syncing={syncing}
        linking={linking}
        onLink={(fullName) =>
          link(
            { fullName },
            {
              onSuccess: (r) => toast.success(`Repositorio ${r.fullName} enlazado.`),
              onError: (err) => toast.error(err.message),
            },
          )
        }
        onSync={() =>
          sync(undefined, {
            onSuccess: (r) => toast.success(describeSyncResult(r)),
            onError: (err) => toast.error(err.message),
          })
        }
        onUnlink={() => setConfirmOpen(true)}
      />

      <ConfirmDialog
        open={confirmOpen}
        title="¿Desenlazar el repositorio?"
        description="El board deja de sincronizarse. Las tarjetas ya importadas se quedan, con la energía y las fechas que les pusiste."
        onConfirm={() => {
          setConfirmOpen(false);
          unlink(undefined, {
            onSuccess: () => toast.success("Repositorio desenlazado."),
            onError: (err) => toast.error(err.message),
          });
        }}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}
