'use client';

import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  getArchetype,
  seedUnitField,
  seedUnitNoun,
  type ArchetypeIdentity,
} from '../onboarding.archetypes';
import type { SeedUnitInput } from '../onboarding.schemas';

interface Props {
  identity: ArchetypeIdentity;
  name: string;
  onNameChange: (v: string) => void;
  units: SeedUnitInput[];
  onUnitsChange: (v: SeedUnitInput[]) => void;
  onNext: () => void;
  onBack: () => void;
}

/**
 * El paso donde el onboarding deja de ser un cuestionario: nombre del primer
 * sistema y, debajo, las unidades reales del arquetipo (clases, milestones, la
 * obra, lo que estás construyendo). Todo el vocabulario sale del manifiesto —
 * este componente no sabe qué es una "clase".
 */
export function StepFirstSystem({
  identity,
  name,
  onNameChange,
  units,
  onUnitsChange,
  onNext,
  onBack,
}: Props) {
  const archetype = getArchetype(identity);
  const { seed } = archetype;
  const noun = seedUnitNoun(archetype);
  const field = seedUnitField(archetype);
  const fieldOptions = field?.options ?? [];

  function setUnit(index: number, patch: Partial<SeedUnitInput>) {
    onUnitsChange(units.map((u, i) => (i === index ? { ...u, ...patch } : u)));
  }

  function addUnit() {
    if (units.length >= seed.maxUnits) return;
    onUnitsChange([...units, { name: '', ...(fieldOptions[0] ? { field: fieldOptions[0].value } : {}) }]);
  }

  function removeUnit(index: number) {
    onUnitsChange(units.filter((_, i) => i !== index));
  }

  return (
    <div className="flex flex-col gap-6 max-w-md mx-auto w-full">
      <div className="space-y-1">
        <h2 className="text-2xl font-bold tracking-tight">Arma tu primer sistema</h2>
        <p className="text-muted-foreground">
          Un sistema es el espacio donde vive un área de tu vida. Puedes crear más después.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="system-name">Nombre del sistema</Label>
        <Input
          id="system-name"
          placeholder={archetype.systemNamePlaceholder}
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          maxLength={100}
          autoFocus
        />
        <div className="flex flex-wrap gap-2 pt-1">
          {archetype.systemNameSuggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onNameChange(s)}
              className="px-3 py-1 rounded-full border border-border bg-card text-sm hover:border-muted-foreground/40 transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3 rounded-xl border bg-card p-4">
        <div className="space-y-1">
          <p className="font-medium text-sm">{seed.title}</p>
          <p className="text-sm text-muted-foreground">{seed.subtitle}</p>
        </div>

        <div className="space-y-2">
          {units.map((unit, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                aria-label={`${noun.singular} ${i + 1}`}
                placeholder={seed.placeholders[i] ?? seed.placeholders[seed.placeholders.length - 1]}
                value={unit.name}
                onChange={(e) => setUnit(i, { name: e.target.value })}
                maxLength={255}
              />
              {fieldOptions.length > 0 && (
                <Select
                  value={unit.field ?? fieldOptions[0].value}
                  onValueChange={(v) => setUnit(i, { field: v })}
                >
                  <SelectTrigger className="w-32 shrink-0" aria-label={field?.label ?? 'Opción'}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {fieldOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0 text-muted-foreground"
                aria-label={`Quitar ${noun.singular} ${i + 1}`}
                onClick={() => removeUnit(i)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>

        {units.length < seed.maxUnits && (
          <Button type="button" variant="ghost" size="sm" onClick={addUnit} className="gap-1.5">
            <Plus className="w-4 h-4" />
            Añadir {noun.singular}
          </Button>
        )}

        <p className="text-xs text-muted-foreground">
          Puedes dejarlo vacío y añadir {noun.plural} más tarde.
        </p>
      </div>

      <div className="flex gap-3">
        <Button variant="ghost" onClick={onBack} className="flex-1">
          Atrás
        </Button>
        <Button onClick={onNext} disabled={!name.trim()} className="flex-1">
          Siguiente
        </Button>
      </div>
    </div>
  );
}
