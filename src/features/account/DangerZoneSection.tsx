'use client';

import { useState } from 'react';
import { Download, Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from '@/components/ui/responsive-dialog';
import { useExportWorkspace } from '@/features/settings/settings.hooks';
import { useAccount, useDeleteAccount } from './account.hooks';

/**
 * Confirmación del borrado: ofrece la exportación antes y exige escribir el
 * correo de la cuenta. Al terminar se navega en duro a /login para que no
 * quede nada de la cuenta en memoria del cliente.
 */
function DeleteAccountDialog({ email, onClose }: { email: string; onClose: () => void }) {
  const [typed, setTyped] = useState('');
  const [error, setError] = useState<string | null>(null);
  const exportWorkspace = useExportWorkspace();
  const deleteAccount = useDeleteAccount();
  const matches = typed.trim().toLowerCase() === email.toLowerCase();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!matches) return;
    deleteAccount.mutate(
      { email: typed },
      {
        onSuccess: () => window.location.assign('/login?deleted=1'),
        onError: (err) => setError(err.message),
      },
    );
  }

  return (
    <ResponsiveDialog open onOpenChange={(open) => !open && !deleteAccount.isPending && onClose()}>
      <ResponsiveDialogContent className="max-w-md">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Borrar tu cuenta</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            Se borran tus sistemas, tareas, cuadernos, imágenes, claves API y sesiones. No hay
            papelera para esto: no se puede deshacer.
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
          <div className="space-y-0.5 min-w-0">
            <p className="text-sm font-medium">Llévate una copia antes</p>
            <p className="text-xs text-muted-foreground">Un ZIP con todo en Markdown y JSON.</p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2 shrink-0"
            disabled={exportWorkspace.isPending}
            onClick={() => exportWorkspace.mutate()}
          >
            {exportWorkspace.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Download className="size-4" />
            )}
            Exportar
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="delete-account-email">
              Escribe <span className="font-mono break-all">{email}</span> para confirmar
            </Label>
            <Input
              id="delete-account-email"
              type="email"
              autoComplete="off"
              value={typed}
              onChange={(e) => {
                setTyped(e.target.value);
                setError(null);
              }}
              autoFocus
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="ghost" onClick={onClose} disabled={deleteAccount.isPending}>
              Cancelar
            </Button>
            <Button type="submit" variant="destructive" disabled={!matches || deleteAccount.isPending}>
              <Trash2 className="size-4" />
              {deleteAccount.isPending ? 'Borrando…' : 'Borrar mi cuenta'}
            </Button>
          </div>
        </form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

export function DangerZoneSection() {
  const { data: account } = useAccount();
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Zona de peligro</h2>
        <p className="text-sm text-muted-foreground">Lo que no se puede deshacer.</p>
      </div>

      <div className="flex items-center justify-between gap-4 rounded-lg border border-destructive/30 p-4">
        <div className="space-y-0.5">
          <p className="text-sm font-medium">Borrar la cuenta y todos sus datos</p>
          <p className="text-xs text-muted-foreground">
            Todo lo tuyo desaparece de Kino al instante. Antes puedes exportarlo.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="shrink-0 gap-2 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
          disabled={!account}
          onClick={() => setConfirming(true)}
        >
          <Trash2 className="size-4" />
          Borrar cuenta
        </Button>
      </div>

      {confirming && account && (
        <DeleteAccountDialog email={account.email} onClose={() => setConfirming(false)} />
      )}
    </div>
  );
}
