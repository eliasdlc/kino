'use client';

import { Globe } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useUserSettings, useUpdateUserSettings } from './settings.hooks';

export function TimezoneSection() {
  const { data, isLoading } = useUserSettings();
  const { mutate, isPending } = useUpdateUserSettings();

  const deviceTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const mismatch = data != null && data.timezone !== deviceTz;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Zona horaria</h2>
        <p className="text-sm text-muted-foreground">
          Define a qué hora llegan los recordatorios de «vence hoy/mañana».
        </p>
      </div>

      <div className="flex items-center justify-between rounded-lg border p-4 gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Globe className="size-4 text-muted-foreground shrink-0" />
          <div className="space-y-0.5 min-w-0">
            <Label className="text-sm font-medium">Zona horaria de tu cuenta</Label>
            {isLoading ? (
              <Skeleton className="h-4 w-40" />
            ) : (
              <p className="text-xs text-muted-foreground truncate">
                {data?.timezone}
                {mismatch
                  ? `: tu dispositivo está en ${deviceTz}`
                  : ': coincide con tu dispositivo'}
              </p>
            )}
          </div>
        </div>

        {mismatch && (
          <Button
            size="sm"
            onClick={() => mutate({ timezone: deviceTz })}
            disabled={isPending}
            className="shrink-0"
          >
            {isPending ? 'Guardando…' : 'Usar la del dispositivo'}
          </Button>
        )}
      </div>
    </div>
  );
}
