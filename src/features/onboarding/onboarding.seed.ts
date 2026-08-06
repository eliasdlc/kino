import { DEFAULT_MEDIUM, getMedium, parseMediumValue } from '@/shared/lib/mediums';
import { SYSTEM_TYPE_CONFIG } from '@/shared/lib/system-types';
import {
  getArchetype,
  type ArchetypeIdentity,
  type OnboardingArchetype,
  type SeedTaskSpec,
} from './onboarding.archetypes';
import type { SeedUnitInput } from './onboarding.schemas';

/**
 * Planificador de la siembra: traduce lo que el usuario escribió en el onboarding
 * a la estructura concreta que se va a escribir (carpetas, tareas, primer
 * manuscrito). Función **pura** a propósito — el servicio solo la ejecuta, así que
 * el "qué se crea por arquetipo" se testea sin base de datos.
 */

export interface SeedTask {
  title: string;
  /**
   * Arranca hoy. El plan no guarda la fecha: la calcula el servicio con la
   * timezone del usuario, porque "hoy" es un cálculo de servidor y este módulo
   * también corre en el cliente (la previsualización del último paso).
   */
  startsToday: boolean;
  energyLevel?: 'high' | 'medium' | 'low';
  priority?: 'critical' | 'high' | 'medium' | 'low';
  boardStatus?: string;
  metadata: Record<string, unknown> | null;
}

export interface SeedPage {
  title: string;
  content: string | null;
}

export interface SeedFolder {
  name: string;
  metadata: Record<string, unknown> | null;
  tasks: SeedTask[];
  page: SeedPage | null;
}

export interface SeedPlan {
  folders: SeedFolder[];
  /** Tareas colgadas del sistema, sin carpeta. */
  tasks: SeedTask[];
}

const MAX_UNIT_NAME = 255;

function interpolate(template: string, unit: string, systemName: string): string {
  return template.replaceAll('{unidad}', unit).replaceAll('{sistema}', systemName);
}

function toTask(
  spec: SeedTaskSpec,
  unit: string,
  systemName: string,
  allowStartsToday = true,
): SeedTask {
  return {
    title: interpolate(spec.title, unit, systemName).slice(0, 500),
    startsToday: Boolean(spec.startsToday) && allowStartsToday,
    ...(spec.energyLevel ? { energyLevel: spec.energyLevel } : {}),
    ...(spec.priority ? { priority: spec.priority } : {}),
    ...(spec.boardStatus ? { boardStatus: spec.boardStatus } : {}),
    metadata: spec.kind ? { kind: spec.kind } : null,
  };
}

/**
 * Metadata de la carpeta a partir del campo extra que declara el arquetipo
 * (escritor → `medium`). Se normaliza contra el manifiesto correspondiente: un
 * valor suelto nunca entra crudo a `folders.metadata`.
 */
function unitMetadata(
  archetype: OnboardingArchetype,
  rawField: string | undefined,
): Record<string, unknown> | null {
  const fieldId = archetype.seed.unitFieldId;
  if (!fieldId) return null;
  if (fieldId === 'medium') {
    return { medium: parseMediumValue(rawField) ?? DEFAULT_MEDIUM };
  }
  const value = rawField?.trim();
  return value ? { [fieldId]: value } : null;
}

/** Primer manuscrito de una obra: vocabulario y esqueleto salen del medium. */
function unitPage(
  archetype: OnboardingArchetype,
  metadata: Record<string, unknown> | null,
): SeedPage | null {
  if (!archetype.seed.seedFirstPage) return null;
  const medium = getMedium(parseMediumValue(metadata?.medium) ?? DEFAULT_MEDIUM);
  const noun = medium.unit.noun;
  return {
    title: `${noun.charAt(0).toUpperCase()}${noun.slice(1)} 1`,
    content: medium.template || null,
  };
}

/** Nombres útiles: recortados, sin vacíos y sin pasarse del máximo del arquetipo. */
function cleanUnits(units: SeedUnitInput[], maxUnits: number): SeedUnitInput[] {
  return units
    .map((u) => ({ name: u.name.trim().slice(0, MAX_UNIT_NAME), field: u.field }))
    .filter((u) => u.name.length > 0)
    .slice(0, maxUnits);
}

export function buildSeedPlan(
  identity: ArchetypeIdentity,
  systemName: string,
  rawUnits: SeedUnitInput[],
): SeedPlan {
  const archetype = getArchetype(identity);
  const { seed } = archetype;
  const units = cleanUnits(rawUnits, seed.maxUnits);

  const plan: SeedPlan = {
    folders: [],
    tasks: seed.systemTasks.map((spec) => toTask(spec, systemName, systemName)),
  };

  // Un arquetipo sin carpetas (project) o sin vocabulario propio (custom) convierte
  // cada unidad en una tarea suelta: lo que el usuario escribió sigue siendo suyo,
  // solo cambia el contenedor.
  const supportsFolders = SYSTEM_TYPE_CONFIG[archetype.systemType].folderRole !== null;
  if (seed.unitKind === 'task' || !supportsFolders) {
    for (const unit of units) {
      plan.tasks.push(toTask({ ...seed.unitTaskDefaults, title: unit.name }, unit.name, systemName));
    }
    return plan;
  }

  units.forEach((unit, index) => {
    const metadata = unitMetadata(archetype, unit.field);
    plan.folders.push({
      name: unit.name,
      metadata,
      // Solo la primera unidad puede estrenar el día: con tres obras o cinco
      // clases, arrancar todas hoy sería una lista imposible el primer día.
      tasks: seed.unitTasks.map((spec) => toTask(spec, unit.name, systemName, index === 0)),
      page: unitPage(archetype, metadata),
    });
  });

  return plan;
}
