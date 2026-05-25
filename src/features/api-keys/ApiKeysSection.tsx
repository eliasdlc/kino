"use client";

import { useState } from "react";
import { Copy, Check, Trash2, Plus, Key } from "lucide-react";
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

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Button variant="ghost" size="icon" className="size-7 shrink-0" onClick={handleCopy}>
      {copied ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
    </Button>
  );
}

function NewKeyReveal({ created, onClose }: { created: CreatedApiKey; onClose: () => void }) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>API key created</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Copy this key now — it won&apos;t be shown again.
          </p>
          <div className="flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2">
            <code className="flex-1 text-xs break-all font-mono">{created.token}</code>
            <CopyButton text={created.token} />
          </div>
          <div className="rounded-md border bg-muted/30 p-3 space-y-1.5 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">Connect to Claude Code</p>
            <p>Add to <code className="font-mono">~/.claude.json</code> under your project&apos;s mcpServers:</p>
            <pre className="bg-muted rounded p-2 overflow-x-auto text-[11px]">{`"env": {
  "KINO_API_KEY": "${created.token}",
  "KINO_BASE_URL": "https://your-kino-url.app"
}`}</pre>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button onClick={onClose}>Done</Button>
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
    </div>
  );
}
