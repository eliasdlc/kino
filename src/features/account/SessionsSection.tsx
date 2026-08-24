'use client';

import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { LogOut, Monitor, Smartphone } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useRevokeOtherSessions, useRevokeSession, useSessions, type ActiveSessionDto } from './account.hooks';

function deviceLabel(session: ActiveSessionDto): string {
  const { browser, os } = session.device;
  return os ? `${browser} en ${os}` : browser;
}

function SessionRow({ session }: { session: ActiveSessionDto }) {
  const revoke = useRevokeSession();
  const Icon = session.device.mobile ? Smartphone : Monitor;
  const lastActive = formatDistanceToNow(new Date(session.lastActiveAt), { addSuffix: true, locale: es });

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <div className="flex items-center gap-3 min-w-0">
        <Icon className="size-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 space-y-0.5">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium truncate">{deviceLabel(session)}</p>
            {session.current && <Badge variant="secondary">Esta sesión</Badge>}
          </div>
          <p className="text-xs text-muted-foreground truncate">
            Última actividad {lastActive}
            {session.ipAddress ? ` · ${session.ipAddress}` : ''}
          </p>
        </div>
      </div>
      {!session.current && (
        <Button
          variant="ghost"
          size="icon"
          className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
          aria-label={`Cerrar la sesión de ${deviceLabel(session)}`}
          disabled={revoke.isPending}
          onClick={() => revoke.mutate(session.id)}
        >
          <LogOut className="size-4" />
        </Button>
      )}
    </div>
  );
}

/**
 * Dónde está abierta la cuenta. La sesión actual no se cierra desde aquí
 * (para eso está «Cerrar sesión»); las demás, una a una o todas de golpe.
 */
export function SessionsSection() {
  const { data: sessions = [], isLoading } = useSessions();
  const revokeOthers = useRevokeOtherSessions();
  const others = sessions.filter((s) => !s.current);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Sesiones activas</h2>
          <p className="text-sm text-muted-foreground">
            Los dispositivos donde tu cuenta está abierta ahora mismo.
          </p>
        </div>
        {others.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="shrink-0"
            disabled={revokeOthers.isPending}
            onClick={() => revokeOthers.mutate()}
          >
            Cerrar las demás
          </Button>
        )}
      </div>

      <div className="rounded-lg border divide-y">
        {isLoading && (
          <div className="px-4 py-6 text-center text-sm text-muted-foreground">Cargando…</div>
        )}
        {sessions.map((session) => (
          <SessionRow key={session.id} session={session} />
        ))}
      </div>
    </div>
  );
}
