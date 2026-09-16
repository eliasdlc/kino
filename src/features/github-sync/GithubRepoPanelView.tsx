"use client";

import * as React from "react";
import { GitBranch, RefreshCw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { GithubRepoRef } from "./github-sync.types";

/**
 * La parte visible del panel de GitHub del board, sin ninguna dependencia de
 * datos. Vive aparte del contenedor para poder previsualizar sus estados en
 * `/system-design` con los mismos componentes que van a producción.
 */

export type RepoPanelState =
  /** Hay cuenta y repositorio: se puede refrescar. */
  | { kind: "linked"; repo: GithubRepoRef; revoked: boolean }
  /** Hay cuenta pero el sistema no ha elegido repositorio todavía. */
  | { kind: "unlinked" }
  /** No hay cuenta conectada: el trabajo se hace en Ajustes. */
  | { kind: "disconnected" }
  /** No se pudo saber el estado de la conexión: la barra lo dice y ofrece reintentar. */
  | { kind: "error" };

export interface GithubRepoPanelViewProps {
  state: RepoPanelState;
  syncing?: boolean;
  /** El refresco en curso es el que ignora el cursor, no el de cada día. */
  syncingAll?: boolean;
  linking?: boolean;
  onLink?: (fullName: string) => void;
  onSync?: () => void;
  onSyncAll?: () => void;
  onUnlink?: () => void;
  onRetry?: () => void;
}

export function GithubRepoPanelView({
  state,
  syncing = false,
  syncingAll = false,
  linking = false,
  onLink,
  onSync,
  onSyncAll,
  onUnlink,
  onRetry,
}: GithubRepoPanelViewProps) {
  const [input, setInput] = React.useState("");

  if (state.kind === "error") {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-destructive/40 px-3 py-2 text-sm">
        <TriangleAlert className="size-4 shrink-0 text-destructive" />
        <span className="min-w-0 flex-1">
          No se pudo comprobar la conexión con GitHub. El tablero sigue como está.
        </span>
        <Button variant="ghost" size="sm" onClick={onRetry}>
          Reintentar
        </Button>
      </div>
    );
  }

  if (state.kind === "disconnected") {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground">
        <GitBranch className="size-4 shrink-0" />
        <span className="min-w-0 flex-1">
          Conecta GitHub en Ajustes para traer los issues de un repositorio.
        </span>
      </div>
    );
  }

  if (state.kind === "unlinked") {
    return (
      <form
        className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center"
        onSubmit={(e) => {
          e.preventDefault();
          onLink?.(input);
          setInput("");
        }}
      >
        <GitBranch className="hidden size-4 shrink-0 text-muted-foreground sm:block" />
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="owner/repositorio"
          aria-label="Repositorio de GitHub"
          className="min-w-0 flex-1"
        />
        <Button type="submit" size="sm" disabled={linking || !input.trim()}>
          {linking ? "Comprobando…" : "Enlazar"}
        </Button>
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-1.5 rounded-lg border px-3 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <GitBranch className="size-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate text-sm">
          {state.repo.owner}/{state.repo.repo}
          {state.revoked && (
            <span className="ml-2 text-xs text-destructive">
              token caducado: reconecta en Ajustes
            </span>
          )}
        </span>
        <Button
          variant="ghost"
          size="sm"
          disabled={syncing || state.revoked}
          onClick={onSync}
        >
          <RefreshCw
            className={`mr-1.5 size-3.5 ${syncing ? "animate-spin" : ""}`}
          />
          {syncing && !syncingAll ? "Sincronizando…" : "Sincronizar"}
        </Button>
        <Button variant="ghost" size="sm" onClick={onUnlink}>
          Desenlazar
        </Button>
      </div>

      {/* La salida de emergencia, no la acción de cada día: va debajo, en una
          línea que dice lo que cuesta antes de pulsarla. El trabajo en curso se
          cuenta en la etiqueta, como en el botón de arriba. */}
      <p className="pl-6 text-xs text-muted-foreground">
        ¿Faltan issues viejos?{" "}
        <Button
          variant="link"
          size="sm"
          className="h-auto p-0 text-xs font-normal"
          disabled={syncing || state.revoked}
          onClick={onSyncAll}
        >
          {syncingAll ? "Pidiendo el repositorio entero…" : "Pídelo desde el principio"}
        </Button>
        . Deja de contar desde el último refresco y vuelve a leer el repositorio
        entero, así que tarda más que sincronizar.
      </p>
    </div>
  );
}
