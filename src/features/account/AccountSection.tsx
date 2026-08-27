'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from '@/components/ui/responsive-dialog';
import { authClient } from '@/shared/lib/auth-client';
import { resetAnalytics } from '@/shared/observability/analytics.client';
import { useAccount, useChangePassword, useRenameAccount, useRequestEmailChange } from './account.hooks';
import { changeEmailSchema } from './account.schemas';

const PROVIDER_LABELS: Record<string, string> = { google: 'Google', github: 'GitHub' };

function providerNames(providers: string[]): string {
  return providers.map((p) => PROVIDER_LABELS[p] ?? p).join(' y ');
}

/**
 * Pide el correo nuevo. El cambio no se aplica aquí: Better Auth manda un
 * enlace a esa dirección y la cuenta cambia cuando lo confirma.
 */
function ChangeEmailDialog({ currentEmail, onClose }: { currentEmail: string; onClose: () => void }) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const request = useRequestEmailChange();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = changeEmailSchema.safeParse({ newEmail: email });
    if (!parsed.success) {
      setError('Escribe un correo válido');
      return;
    }
    if (parsed.data.newEmail === currentEmail.toLowerCase()) {
      setError('Ese ya es el correo de tu cuenta');
      return;
    }
    request.mutate(parsed.data, {
      onSuccess: () => {
        toast.success(`Te enviamos un enlace a ${parsed.data.newEmail}. El cambio se aplica al confirmarlo.`);
        onClose();
      },
      onError: (err) => setError(err.message),
    });
  }

  return (
    <ResponsiveDialog open onOpenChange={(open) => !open && onClose()}>
      <ResponsiveDialogContent className="max-w-sm">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Cambiar el correo</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            Te enviaremos un enlace a la dirección nueva. Hasta que lo confirmes sigues entrando con{' '}
            <span className="font-medium text-foreground">{currentEmail}</span>.
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="account-new-email">Correo nuevo</Label>
            <Input
              id="account-new-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError(null);
              }}
              autoFocus
              required
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!email.trim() || request.isPending}>
              {request.isPending ? 'Enviando…' : 'Enviar enlace'}
            </Button>
          </div>
        </form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

function ChangePasswordDialog({ onClose }: { onClose: () => void }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [repeat, setRepeat] = useState('');
  const [error, setError] = useState<string | null>(null);
  const change = useChangePassword();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (next.length < 8) {
      setError('La contraseña nueva necesita al menos 8 caracteres');
      return;
    }
    if (next !== repeat) {
      setError('Las dos contraseñas nuevas no coinciden');
      return;
    }
    change.mutate(
      { currentPassword: current, newPassword: next },
      { onSuccess: onClose, onError: (err) => setError(err.message) },
    );
  }

  return (
    <ResponsiveDialog open onOpenChange={(open) => !open && onClose()}>
      <ResponsiveDialogContent className="max-w-sm">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Cambiar la contraseña</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            Al cambiarla se cierran las demás sesiones abiertas con la anterior.
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="account-current-password">Contraseña actual</Label>
            <Input
              id="account-current-password"
              type="password"
              autoComplete="current-password"
              value={current}
              onChange={(e) => {
                setCurrent(e.target.value);
                setError(null);
              }}
              autoFocus
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="account-new-password">Contraseña nueva</Label>
            <Input
              id="account-new-password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              value={next}
              onChange={(e) => {
                setNext(e.target.value);
                setError(null);
              }}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="account-repeat-password">Repite la contraseña nueva</Label>
            <Input
              id="account-repeat-password"
              type="password"
              autoComplete="new-password"
              value={repeat}
              onChange={(e) => {
                setRepeat(e.target.value);
                setError(null);
              }}
              required
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!current || !next || !repeat || change.isPending}>
              {change.isPending ? 'Guardando…' : 'Cambiar contraseña'}
            </Button>
          </div>
        </form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

/**
 * Sección "Cuenta" de Ajustes: nombre, correo, contraseña y cierre de sesión.
 * Sin contraseña (sólo Google o GitHub) la fila de contraseña dice con qué se
 * entra en vez de ofrecer un cambio que fallaría.
 */
export function AccountSection() {
  const router = useRouter();
  const { data: account, isLoading } = useAccount();
  const rename = useRenameAccount();
  // null mientras no se ha tocado el campo: así el valor guardado sigue
  // mandando si llega o cambia después del primer render.
  const [draft, setDraft] = useState<string | null>(null);
  const [dialog, setDialog] = useState<'email' | 'password' | null>(null);

  const name = draft ?? account?.name ?? '';
  const trimmed = name.trim();
  const dirty = account != null && trimmed.length > 0 && trimmed !== account.name;

  function handleRename(e: React.FormEvent) {
    e.preventDefault();
    if (!dirty) return;
    rename.mutate(trimmed, {
      onSuccess: () => {
        setDraft(null);
        // El nombre también lo pinta el sidebar, que es server-side.
        router.refresh();
      },
    });
  }

  async function handleSignOut() {
    await authClient.signOut();
    resetAnalytics();
    router.push('/login');
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Cuenta</h2>
        <p className="text-sm text-muted-foreground">Quién eres en Kino y cómo entras.</p>
      </div>

      <div className="rounded-lg border divide-y">
        <form onSubmit={handleRename} className="flex items-end justify-between gap-4 p-4">
          <div className="min-w-0 flex-1 space-y-1.5">
            <Label htmlFor="account-name">Nombre</Label>
            {isLoading ? (
              <Skeleton className="h-9 w-full max-w-xs" />
            ) : (
              <Input
                id="account-name"
                value={name}
                onChange={(e) => setDraft(e.target.value)}
                maxLength={100}
                autoComplete="name"
                className="max-w-xs"
              />
            )}
          </div>
          <Button type="submit" variant="outline" size="sm" disabled={!dirty || rename.isPending}>
            {rename.isPending ? 'Guardando…' : 'Guardar'}
          </Button>
        </form>

        <div className="flex items-center justify-between gap-4 p-4">
          <div className="min-w-0 space-y-0.5">
            <p className="text-sm font-medium">Correo</p>
            {isLoading ? (
              <Skeleton className="h-4 w-48" />
            ) : (
              <div className="flex items-center gap-2 min-w-0">
                <p className="text-xs text-muted-foreground truncate">{account?.email}</p>
                {account && !account.emailVerified && <Badge variant="secondary">Sin confirmar</Badge>}
              </div>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0"
            disabled={!account}
            onClick={() => setDialog('email')}
          >
            Cambiar
          </Button>
        </div>

        <div className="flex items-center justify-between gap-4 p-4">
          <div className="min-w-0 space-y-0.5">
            <p className="text-sm font-medium">Contraseña</p>
            {isLoading ? (
              <Skeleton className="h-4 w-40" />
            ) : account?.hasPassword ? (
              <p className="text-xs text-muted-foreground">
                Cambiarla cierra las sesiones abiertas en otros dispositivos.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Entras con {providerNames(account?.providers ?? [])}: no hay contraseña que cambiar.
              </p>
            )}
          </div>
          {account?.hasPassword && (
            <Button variant="outline" size="sm" className="shrink-0" onClick={() => setDialog('password')}>
              Cambiar
            </Button>
          )}
        </div>

        <div className="flex items-center justify-between gap-4 p-4">
          <div className="space-y-0.5">
            <p className="text-sm font-medium">Cerrar sesión</p>
            <p className="text-xs text-muted-foreground">Sólo en este dispositivo.</p>
          </div>
          <Button variant="outline" size="sm" className="gap-2 shrink-0" onClick={handleSignOut}>
            <LogOut className="size-4" />
            Cerrar sesión
          </Button>
        </div>
      </div>

      {dialog === 'email' && account && (
        <ChangeEmailDialog currentEmail={account.email} onClose={() => setDialog(null)} />
      )}
      {dialog === 'password' && <ChangePasswordDialog onClose={() => setDialog(null)} />}
    </div>
  );
}
