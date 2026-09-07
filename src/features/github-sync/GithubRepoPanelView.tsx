"use client";

import * as React from "react";
import { GitBranch, RefreshCw } from "lucide-react";
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
  | { kind: "disconnected" };

export interface GithubRepoPanelViewProps {
  state: RepoPanelState;
  syncing?: boolean;
  linking?: boolean;
  onLink?: (fullName: string) => void;
  onSync?: () => void;
  onUnlink?: () => void;
}

export function GithubRepoPanelView({
  state,
  syncing = false,
  linking = false,
  onLink,
  onSync,
  onUnlink,
}: GithubRepoPanelViewProps) {
  const [input, setInput] = React.useState("");

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
    <div className="flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2">
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
        {syncing ? "Sincronizando…" : "Sincronizar"}
      </Button>
      <Button variant="ghost" size="sm" onClick={onUnlink}>
        Desenlazar
      </Button>
    </div>
  );
}
