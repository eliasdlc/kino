"use client";

import { useState } from "react";
import { Copy, Check, Trash2, Plus, Key, Terminal } from "lucide-react";
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
  useApiKeys,
  useCreateApiKey,
  useDeleteApiKey,
  type CreatedApiKey,
} from "./api-keys.hooks";

function CopyButton({ text, className }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Button variant="ghost" size="icon" className={className ?? "size-7 shrink-0"} onClick={handleCopy}>
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
          <DialogTitle>API key created</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Copy this key now — it won&apos;t be shown again.
            </p>
            <div className="flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2">
              <code className="flex-1 text-xs break-all font-mono">{created.token}</code>
              <CopyButton text={created.token} />
            </div>
          </div>

          <div className="rounded-md border bg-muted/30 p-3 space-y-2">
            <p className="text-xs font-medium">MCP config (manual)</p>
            <p className="text-xs text-muted-foreground">
              Si prefieres configurar manualmente, añade esto a <code className="font-mono">~/.claude.json</code> bajo <code className="font-mono">mcpServers</code>.
            </p>
            <div className="relative">
              <pre className="bg-muted rounded-md p-3 overflow-x-auto text-[11px] font-mono pr-8">{config}</pre>
              <CopyButton text={config} className="absolute top-1.5 right-1.5 size-7 bg-background/80 hover:bg-background" />
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
  const createKey = useCreateApiKey();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    createKey.mutate({ name: name.trim() });
  }

  if (createKey.data) {
    return <NewKeyReveal created={createKey.data} onClose={onClose} />;
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Create API key</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="key-name">Name</Label>
            <Input
              id="key-name"
              placeholder="e.g. Claude Code local"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              A label to identify where this key is used.
            </p>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost" onClick={onClose}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={!name.trim() || createKey.isPending}>
              {createKey.isPending ? "Creating…" : "Create"}
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

export function ApiKeysSection() {
  const { data: keys = [], isLoading } = useApiKeys();
  const deleteKey = useDeleteApiKey();
  const [creating, setCreating] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold">API Keys</h2>
          <p className="text-sm text-muted-foreground">
            Connect Claude Code, Cursor, and other AI tools to Kino.
          </p>
        </div>
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus className="size-4 mr-1.5" />
          New key
        </Button>
      </div>

      {creating && <CreateKeyDialog onClose={() => setCreating(false)} />}

      <div className="rounded-lg border divide-y">
        {isLoading && (
          <div className="px-4 py-6 text-center text-sm text-muted-foreground">
            Loading…
          </div>
        )}

        {!isLoading && keys.length === 0 && (
          <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
            <Key className="size-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No API keys yet.</p>
          </div>
        )}

        {keys.map((key) => (
          <div key={key.id} className="flex items-center justify-between px-4 py-3">
            <div className="space-y-0.5 min-w-0">
              <p className="text-sm font-medium truncate">{key.name}</p>
              <p className="text-xs text-muted-foreground font-mono">
                {key.keyPrefix}••••••••••••
              </p>
              <p className="text-xs text-muted-foreground">
                {key.lastUsedAt
                  ? `Last used ${new Date(key.lastUsedAt).toLocaleDateString()}`
                  : `Created ${new Date(key.createdAt).toLocaleDateString()} — never used`}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
              onClick={() => deleteKey.mutate(key.id)}
              disabled={deleteKey.isPending}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
      </div>

      <ClaudeCodeGuide />
    </div>
  );
}
