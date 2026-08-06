import { z } from 'zod';
import { ARCHETYPE_IDENTITIES, DEFAULT_IDENTITY } from './onboarding.archetypes';

const rechargePresetSchema = z.object({
  label: z.string().min(1).max(50),
  delta: z.number().int().min(-50).max(50),
});

/**
 * Unidad sembrada en el onboarding: lo que el usuario escribió en el paso de
 * primer sistema. `field` es el campo extra que declara el arquetipo (el medium
 * de una obra); se normaliza contra su manifiesto antes de tocar la base.
 */
const seedUnitSchema = z.object({
  name: z.string().min(1).max(255),
  field: z.string().max(100).optional(),
});

export const setupProfileSchema = z.object({
  // Bifurcación por identidad (D14): decide el arquetipo del primer sistema y con
  // qué contenido real termina el onboarding.
  identity: z.enum(ARCHETYPE_IDENTITIES).default(DEFAULT_IDENTITY),
  chronotype: z.enum(['morning', 'intermediate', 'evening']),
  sleepTypicalHours: z.number().int().min(4).max(12),
  availableHoursPerDay: z.number().int().min(1).max(16),
  rechargePresets: z.array(rechargePresetSchema).max(8).default([]),
  firstSystemName: z.string().min(1).max(100),
  seedUnits: z.array(seedUnitSchema).max(6).default([]),
  // IANA timezone capturada en el cliente (Intl). Ancla el cálculo de "hoy".
  timezone: z.string().min(1).max(50).optional(),
});

export type SetupProfileInput = z.infer<typeof setupProfileSchema>;
export type SeedUnitInput = z.infer<typeof seedUnitSchema>;
