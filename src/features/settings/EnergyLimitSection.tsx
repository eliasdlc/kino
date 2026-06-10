'use client';

import { useState } from 'react';
import { Battery } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useUserSettings, useUpdateUserSettings } from './settings.hooks';

export function EnergyLimitSection() {
  const { data, isLoading } = useUserSettings();
  const { mutate, isPending } = useUpdateUserSettings();

  const [value, setValue] = useState<string>('');
  const [syncedLimit, setSyncedLimit] = useState<number | null>(null);

  // Sincroniza el input local cuando llegan/cambian los datos del servidor,
  // ajustando estado durante el render (patrón recomendado en vez de un effect).
  if (data && data.dailyEnergyLimit !== syncedLimit) {
    setSyncedLimit(data.dailyEnergyLimit);
    setValue(String(data.dailyEnergyLimit));
  }

  const numeric = Number(value);
  const isValid = Number.isInteger(numeric) && numeric >= 1 && numeric <= 500;
  const isDirty = data != null && numeric !== data.dailyEnergyLimit;

  function handleSave() {
    if (!isValid || !isDirty) return;
    mutate({ dailyEnergyLimit: numeric });
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Energía</h2>
        <p className="text-sm text-muted-foreground">
          Controla cuánta energía puedes asignar a un solo día.
        </p>
      </div>

      <div className="flex items-center justify-between rounded-lg border p-4 gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Battery className="size-4 text-muted-foreground shrink-0" />
          <div className="space-y-0.5 min-w-0">
            <Label htmlFor="energy-limit" className="text-sm font-medium">
              Límite de energía diario
            </Label>
            <p className="text-xs text-muted-foreground">
              Al superarlo, Kino impide mover más tareas a «Hoy».
            </p>
          </div>
        </div>

        {isLoading ? (
          <Skeleton className="h-9 w-[120px] rounded-md" />
        ) : (
          <div className="flex items-center gap-2 shrink-0">
            <Input
              id="energy-limit"
              type="number"
              min={1}
              max={500}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              className="w-20 text-right"
            />
            <Button
              size="sm"
              onClick={handleSave}
              disabled={!isValid || !isDirty || isPending}
            >
              {isPending ? 'Guardando…' : 'Guardar'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
