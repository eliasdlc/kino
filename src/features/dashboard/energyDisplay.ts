import type { CheckinSlot } from '@/features/energy/energy.schemas';

// Presentación compartida por las piezas de "Energía de hoy".

export const SLOT_LABELS: Record<CheckinSlot, string> = {
  morning: 'Mañana',
  afternoon: 'Tarde',
  evening: 'Noche',
};

export const SLOT_HOURS: Record<CheckinSlot, [number, number]> = {
  morning: [6, 12],
  afternoon: [12, 18],
  evening: [18, 24],
};

export const SLEEP_LABELS: Record<string, string> = {
  good: 'Bien',
  partial: 'Regular',
  poor: 'Mal',
};

export const SLEEP_COLORS: Record<string, string> = {
  good: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 ring-emerald-500/30',
  partial: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 ring-amber-500/30',
  poor: 'bg-red-500/15 text-red-500 dark:text-red-400 ring-red-500/30',
};

export function levelColor(level: number): string {
  if (level >= 70) return 'text-emerald-500';
  if (level >= 40) return 'text-amber-400';
  return 'text-red-400';
}

export function getCurrentSlot(hour: number = new Date().getHours()): CheckinSlot {
  if (hour >= 6 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 18) return 'afternoon';
  return 'evening';
}

export type EnergyTone = 'high' | 'medium' | 'low';

export interface EnergyReading {
  value: number;
  tone: EnergyTone;
  label: string;
  hint: string;
}

/** Interpreta un nivel 0–100 en etiqueta + consejo de qué tipo de tarea encaja. */
export function interpretEnergy(value: number): EnergyReading {
  const tone: EnergyTone = value >= 70 ? 'high' : value >= 40 ? 'medium' : 'low';
  const label = tone === 'high' ? 'Energía alta' : tone === 'medium' ? 'Energía media' : 'Energía baja';
  const hint =
    tone === 'high'
      ? 'Buen momento para lo más exigente.'
      : tone === 'medium'
        ? 'Mejor para tareas de enfoque medio.'
        : 'Ideal para algo ligero o un respiro.';
  return { value, tone, label, hint };
}
