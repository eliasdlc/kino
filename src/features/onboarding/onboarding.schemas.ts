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

/**
 * Perfil de energía con el que nace una cuenta. El alta no pregunta ninguno de
 * los tres: un perfil declarado el día 1 es una suposición, y Kino mide en vez
 * de suponer. Los valores son los que el wizard de ocho pasos ya proponía como
 * default, así que una cuenta nueva arranca donde arrancaba antes; lo que cambia
 * es quién los escribe. El momento en que el producto vuelve a preguntar el
 * cronotipo, con la curva medida delante, lo decide el motor de energía a los
 * catorce días, no esta pantalla.
 */
export const ENERGY_PROFILE_DEFAULTS = {
  chronotype: 'intermediate',
  sleepTypicalHours: 7,
  availableHoursPerDay: 8,
} as const;

/**
 * Versión del camino de entrada. La 1 es el wizard de ocho pasos; la 2 son dos
 * pantallas y una pregunta. Se guarda en `userSettings.onboardingVersion` para
 * que una cuenta vieja no vuelva a ver un paso que ya contestó y para poder
 * comparar el embudo antes y después.
 */
export const ONBOARDING_VERSION = 2;

export const setupProfileSchema = z.object({
  // Bifurcación por identidad (D14): decide el arquetipo del primer sistema y con
  // qué contenido real termina el onboarding. Es la única pregunta del alta.
  identity: z.enum(ARCHETYPE_IDENTITIES).default(DEFAULT_IDENTITY),
  chronotype: z
    .enum(['morning', 'intermediate', 'evening'])
    .default(ENERGY_PROFILE_DEFAULTS.chronotype),
  sleepTypicalHours: z
    .number()
    .int()
    .min(4)
    .max(12)
    .default(ENERGY_PROFILE_DEFAULTS.sleepTypicalHours),
  availableHoursPerDay: z
    .number()
    .int()
    .min(1)
    .max(16)
    .default(ENERGY_PROFILE_DEFAULTS.availableHoursPerDay),
  rechargePresets: z.array(rechargePresetSchema).max(8).default([]),
  // Sin nombre escrito, el sistema nace con el del arquetipo: el alta no pide
  // uno y `systemNameDefault` nunca está vacío.
  firstSystemName: z.string().min(1).max(100).optional(),
  seedUnits: z.array(seedUnitSchema).max(6).default([]),
  // IANA timezone capturada en el cliente (Intl). Ancla el cálculo de "hoy".
  timezone: z.string().min(1).max(50).optional(),
});

export type SetupProfileInput = z.infer<typeof setupProfileSchema>;
export type SeedUnitInput = z.infer<typeof seedUnitSchema>;
