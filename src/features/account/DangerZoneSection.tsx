'use client';

import { useState } from 'react';
import { Download, Trash2 } from 'lucide-react';
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
import { IndexRow } from '@/features/settings/settings-ui';
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
            Se borran tus sistemas, tareas, cuadernos, imágenes y sesiones. No hay
            papelera para esto: no se puede deshacer.
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        {/* La copia antes de irse, en una fila con hairline y no en una caja. */}
        <div className="space-y-2 border-y border-border py-3">
          <p className="text-sm font-semibold text-foreground">Llévate una copia antes</p>
          <p className="text-sm text-muted-foreground">Un ZIP con todo en Markdown y JSON.</p>
          <Button
            type="button"
            variant="outline"
            disabled={exportWorkspace.isPending}
            onClick={() => exportWorkspace.mutate()}
          >
            <Download aria-hidden className="size-4" />
            {exportWorkspace.isPending ? 'Preparando el ZIP' : 'Exportar'}
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
              <Trash2 aria-hidden className="size-4" />
              {deleteAccount.isPending ? 'Borrando la cuenta' : 'Borrar mi cuenta'}
            </Button>
          </div>
        </form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

/**
 * La última fila de Una vez: borrar la cuenta. Va al final, después de la
 * exportación, porque es el orden natural de irse. Abre la confirmación que
 * pide escribir el correo; la fila espera a saber cuál es.
 */
export function DangerZoneSection() {
  const { data: account } = useAccount();
  const [confirming, setConfirming] = useState(false);

  return (
    <>
      <IndexRow
        tone="danger"
        icon={<Trash2 aria-hidden className="size-5 stroke-[1.8]" />}
        title="Borrar la cuenta"
        meta="Todo, sin papelera; antes puedes exportarlo"
        onOpen={account ? () => setConfirming(true) : undefined}
      />
      {confirming && account && (
        <DeleteAccountDialog email={account.email} onClose={() => setConfirming(false)} />
      )}
    </>
  );
}
