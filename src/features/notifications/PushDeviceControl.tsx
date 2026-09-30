'use client';

import { Bell, BellOff } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import type { usePushNotifications } from './notifications.hooks';

type PushDeviceProps = ReturnType<typeof usePushNotifications>;

export function PushDeviceControl({ status, error: pushError, subscribe, unsubscribe }: PushDeviceProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
        <div className="flex items-center gap-3">
          {status === 'subscribed'
            ? <Bell className="size-4 text-emerald-500" />
            : <BellOff className="size-4 text-muted-foreground" />}
          <div className="space-y-0.5">
            <Label className="text-sm font-medium">Notificaciones push en este dispositivo</Label>
            <p className="text-xs text-muted-foreground">
              {status === 'subscribed'   && 'Activas: recibirás alertas en este dispositivo'}
              {status === 'denied'       && 'Bloqueadas: actívalas en los permisos del navegador'}
              {status === 'unsupported'  && 'No soportado en este navegador'}
              {status === 'error'        && pushError}
              {(status === 'idle' || status === 'loading') && 'Inactivas'}
            </p>
          </div>
        </div>
        <Switch
          checked={status === 'subscribed'}
          disabled={status === 'loading' || status === 'denied' || status === 'unsupported'}
          onCheckedChange={(checked) => (checked ? subscribe() : unsubscribe())}
        />
      </div>

      {status === 'denied' && (
        <p className="text-xs text-amber-600 dark:text-amber-400 px-1">
          Bloqueaste las notificaciones. Ve a los permisos del sitio en tu navegador para reactivarlas.
        </p>
      )}
    </div>
  );
}
