"use client";

import { useState } from "react";
import { Copy, Check, Trash2, Plus, Key, Terminal, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import {
  useApiKeys,
  useCreateApiKey,
  useDeleteApiKey,
  useRevokeApiKey,
  type ApiKeyRecord,
  type CreatedApiKey,
} from "./api-keys.hooks";
import type { ApiKeyTtl } from "./api-keys.schemas";

const TTL_OPTIONS: Array<{ value: ApiKeyTtl; label: string }> = [
  { value: "d30", label: "30 días" },
  { value: "d90", label: "90 días" },
  { value: "y1", label: "Un año" },
  { value: "never", label: "Sin caducidad" },
];

/** Una clave sirve para autenticar mientras no esté revocada ni caducada. */
function keyState(key: ApiKeyRecord): "active" | "revoked" | "expired" {
  if (key.revokedAt) return "revoked";
  if (key.expiresAt && new Date(key.expiresAt).getTime() <= Date.now()) return "expired";
  return "active";
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString();
}

function CopyButton({
  text,
  label,
  className,
}: {
  text: string;
  /** Qué se copia. Obligatorio: el botón sólo es un icono. */
  label: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={copied ? `${label}: copiado` : label}
      className={className ?? "size-7 shrink-0"}
      onClick={handleCopy}
    >
      {copied ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
    </Button>
  );
}

function mcpConfig(token: string) {
  return `{
  "mcpServers": {
    "kino": {
      "command": "npx",
      "args": ["-y", "@kino-app/mcp"],
      "env": {
        "KINO_API_KEY": "${token}",
        "KINO_BASE_URL": "https://usekino.dev"
      }
    }
  }
}`;
}

const MCP_TOOLS = [
  { name: "get_user_context", desc: "Snapshot completo: sistemas, tareas de hoy, energía y patrón activo" },
  { name: "suggest_next_action", desc: "Tareas rankeadas por importancia según tu energía actual" },
  { name: "classify_task", desc: "Sugiere a qué sistema y prioridad pertenece una tarea nueva" },
  { name: "detect_patterns", desc: "Detecta sobrecarga, abandono o desorganización en tu flujo" },
  { name: "get_energy_distribution", desc: "Cuánta energía has gastado por sistema esta semana" },
  { name: "find_stale_systems", desc: "Sistemas sin actividad reciente que podrían estar abandonados" },
  { name: "generate_subtasks", desc: "Descompone una tarea compleja en pasos accionables con IA" },
  { name: "create_task / bulk_create_tasks", desc: "Crea tareas directamente desde la conversación" },
];

function NewKeyReveal({ created, onClose }: { created: CreatedApiKey; onClose: () => void }) {
  const config = mcpConfig(created.token);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Clave API creada</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Copia esta clave ahora — no se mostrará de nuevo.
            </p>
            <div className="flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2">
              <code className="flex-1 text-xs break-all font-mono">{created.token}</code>
              <CopyButton text={created.token} label="Copiar la clave al portapapeles" />
            </div>
          </div>

          <div className="rounded-md border bg-muted/30 p-3 space-y-2">
            <p className="text-xs font-medium">MCP config (manual)</p>
            <p className="text-xs text-muted-foreground">
              Si prefieres configurar manualmente, añade esto a <code className="font-mono">~/.claude.json</code> bajo <code className="font-mono">mcpServers</code>.
            </p>
            <div className="relative">
              <pre className="bg-muted rounded-md p-3 overflow-x-auto text-[11px] font-mono pr-8">{config}</pre>
              <CopyButton
                text={config}
                label="Copiar la configuración MCP al portapapeles"
                className="absolute top-1.5 right-1.5 size-7 bg-background/80 hover:bg-background"
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button onClick={onClose}>Listo</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CreateKeyDialog({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const [ttl, setTtl] = useState<ApiKeyTtl>("d90");
  const createKey = useCreateApiKey();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    createKey.mutate({ name: name.trim(), ttl });
  }

  if (createKey.data) {
    return <NewKeyReveal created={createKey.data} onClose={onClose} />;
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Crear clave API</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="key-name">Nombre</Label>
            <Input
              id="key-name"
              placeholder="ej. Claude Code local"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              Una etiqueta para identificar dónde se usa esta clave.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="key-ttl">Caduca en</Label>
            <Select value={ttl} onValueChange={(v) => setTtl(v as ApiKeyTtl)}>
              <SelectTrigger id="key-ttl" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TTL_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Una clave que se escapa sirve hasta que caduca. Elige el plazo más
              corto con el que puedas trabajar.
            </p>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost" onClick={onClose}>
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit" disabled={!name.trim() || createKey.isPending}>
              {createKey.isPending ? "Creando…" : "Crear"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const SETUP_COMMAND = 'npx @kino-app/mcp setup';

function ClaudeCodeGuide() {
  return (
    <div className="rounded-lg border bg-muted/20 p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Terminal className="size-4 text-muted-foreground shrink-0" />
        <div>
          <p className="text-sm font-medium">Conectar con Claude Code</p>
          <p className="text-xs text-muted-foreground">
            Permite que Claude gestione tus tareas, sistemas y energía directamente desde la conversación.
          </p>
        </div>
      </div>

      <ol className="space-y-3 text-sm">
        <li className="flex gap-3">
          <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground mt-0.5">1</span>
          <div className="space-y-2 flex-1 min-w-0">
            <span className="text-muted-foreground">
              Ejecuta este comando en tu terminal:
            </span>
            <div className="relative">
              <pre className="rounded-md bg-muted p-3 text-[11px] font-mono overflow-x-auto pr-8">{SETUP_COMMAND}</pre>
              <CopyButton
                text={SETUP_COMMAND}
                label="Copiar el comando al portapapeles"
                className="absolute top-1.5 right-1.5 size-7 bg-background/80 hover:bg-background"
              />
            </div>
          </div>
        </li>
        <li className="flex gap-3">
          <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground mt-0.5">2</span>
          <span className="text-muted-foreground">
            Se abrirá el browser automáticamente. Inicia sesión si aún no lo has hecho.
          </span>
        </li>
        <li className="flex gap-3">
          <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground mt-0.5">3</span>
          <span className="text-muted-foreground">
            Reinicia Claude Code. Las tools de Kino aparecen automáticamente.
          </span>
        </li>
      </ol>

      <div className="space-y-2 pt-1 border-t">
        <p className="text-xs font-medium text-muted-foreground">Tools disponibles</p>
        <div className="grid gap-1.5">
          {MCP_TOOLS.map((tool) => (
            <div key={tool.name} className="flex gap-2 text-xs">
              <code className="shrink-0 font-mono text-foreground/80">{tool.name}</code>
              <span className="text-muted-foreground">— {tool.desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Confirmación antes de borrar. Borrar una clave no se deshace (sólo se guarda
 * el hash) y mata la conexión de la máquina que la use, así que además de
 * confirmar ofrece revocar, que deja registro de que la clave existió.
 */
function DeleteKeyDialog({
  apiKey,
  onClose,
}: {
  apiKey: ApiKeyRecord;
  onClose: () => void;
}) {
  const deleteKey = useDeleteApiKey();
  const revokeKey = useRevokeApiKey();
  const canRevoke = keyState(apiKey) === "active";

  return (
    <ResponsiveDialog open onOpenChange={(open) => !open && onClose()}>
      <ResponsiveDialogContent className="max-w-sm">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Borrar «{apiKey.name}»</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            La clave <span className="font-mono">{apiKey.keyPrefix}••••</span> desaparece
            de la lista y no se puede recuperar. Lo que la use dejará de conectar.
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={onClose} autoFocus>
            Cancelar
          </Button>
          {canRevoke && (
            <Button
              variant="outline"
              disabled={revokeKey.isPending}
              onClick={() => revokeKey.mutate(apiKey.id, { onSuccess: onClose })}
            >
              <Ban className="size-4" />
              Revocar
            </Button>
          )}
          <Button
            variant="destructive"
            disabled={deleteKey.isPending}
            onClick={() => deleteKey.mutate(apiKey.id, { onSuccess: onClose })}
          >
            <Trash2 className="size-4" />
            Borrar
          </Button>
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

function ApiKeyRow({ apiKey }: { apiKey: ApiKeyRecord }) {
  const revokeKey = useRevokeApiKey();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const state = keyState(apiKey);

  return (
    <div className="flex items-center justify-between gap-2 px-4 py-3">
      <div className="space-y-0.5 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium truncate">{apiKey.name}</p>
          {state !== "active" && (
            <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider bg-muted text-muted-foreground">
              {state === "revoked" ? "Revocada" : "Caducada"}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground font-mono">
          {apiKey.keyPrefix}••••••••••••
        </p>
        <p className="text-xs text-muted-foreground">
          {apiKey.lastUsedAt
            ? `Último uso ${formatDate(apiKey.lastUsedAt)}`
            : `Creada ${formatDate(apiKey.createdAt)}, sin usar`}
          {" · "}
          {apiKey.revokedAt
            ? `revocada el ${formatDate(apiKey.revokedAt)}`
            : apiKey.expiresAt
              ? `${state === "expired" ? "caducó" : "caduca"} el ${formatDate(apiKey.expiresAt)}`
              : "no caduca"}
        </p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {state === "active" && (
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground hover:text-foreground"
            aria-label={`Revocar la clave ${apiKey.name}`}
            disabled={revokeKey.isPending}
            onClick={() => revokeKey.mutate(apiKey.id)}
          >
            <Ban className="size-4" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="size-8 text-muted-foreground hover:text-destructive"
          aria-label={`Borrar la clave ${apiKey.name}`}
          onClick={() => setConfirmingDelete(true)}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
      {confirmingDelete && (
        <DeleteKeyDialog apiKey={apiKey} onClose={() => setConfirmingDelete(false)} />
      )}
    </div>
  );
}

export function ApiKeysSection() {
  const { data: keys = [], isLoading } = useApiKeys();
  const [creating, setCreating] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold">Claves API</h2>
          <p className="text-sm text-muted-foreground">
            Conecta Claude Code, Cursor y otras herramientas de IA con Kino.
          </p>
        </div>
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus className="size-4 mr-1.5" />
          Nueva clave
        </Button>
      </div>

      {creating && <CreateKeyDialog onClose={() => setCreating(false)} />}

      <div className="rounded-lg border divide-y">
        {isLoading && (
          <div className="px-4 py-6 text-center text-sm text-muted-foreground">
            Cargando…
          </div>
        )}

        {!isLoading && keys.length === 0 && (
          <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
            <Key className="size-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">Aún no hay claves API.</p>
          </div>
        )}

        {keys.map((key) => (
          <ApiKeyRow key={key.id} apiKey={key} />
        ))}
      </div>

      <ClaudeCodeGuide />
    </div>
  );
}
