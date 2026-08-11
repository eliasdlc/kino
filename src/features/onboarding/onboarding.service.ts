import { userToday, zonedDayHourToUtc } from '@/shared/time';
import { getUserTimezone } from '@/shared/time/user-timezone';
import { createFolder } from '../folders/folders.service';
import { createPage } from '../pages/pages.service';
import { createSystem } from '../systems/systems.service';
import { bulkCreateTasks } from '../tasks/tasks.service';
import type { CreateTaskInput } from '../tasks/tasks.types';
import { archetypeEnergyIdeal, getArchetype } from './onboarding.archetypes';
import {
  insertEnergyProfile,
  markOnboardingComplete,
  saveArchetypeIdentity,
  saveUserTimezone,
} from './onboarding.queries';
import type { SetupProfileInput } from './onboarding.schemas';
import { buildSeedPlan, type SeedPlan, type SeedTask } from './onboarding.seed';

/**
 * Hora local a la que arranca una tarea sembrada "de hoy". Un instante real y no
 * un día pelado: `yyyy-MM-dd` entraría a la columna timestamptz como medianoche
 * UTC y en una tz negativa el reconciliador lo leería como el día anterior.
 */
const SEED_START_HOUR = 9;

function toCreateTaskInput(
  systemId: string,
  folderId: string | undefined,
  task: SeedTask,
  todayStartISO: string,
): CreateTaskInput {
  return {
    systemId,
    title: task.title,
    ...(folderId ? { folderId } : {}),
    // El status de scheduling no se siembra: lo deriva `createTask` de la fecha,
    // igual que hace el reconciliador en cada carga.
    ...(task.startsToday ? { startDate: todayStartISO } : {}),
    ...(task.energyLevel ? { energyLevel: task.energyLevel } : {}),
    ...(task.priority ? { priority: task.priority } : {}),
    ...(task.boardStatus ? { boardStatus: task.boardStatus } : {}),
    ...(task.metadata ? { metadata: task.metadata } : {}),
  };
}

/**
 * Escribe el plan de siembra: primero las carpetas (para tener sus ids), luego
 * todas las tareas en un solo lote transaccional y por último los manuscritos.
 * Cada página va en su propio try — que falle el primer capítulo de una obra no
 * debe tumbar el resto de la siembra.
 */
async function applySeedPlan(
  userId: string,
  systemId: string,
  plan: SeedPlan,
  timezone: string,
) {
  const todayStartISO = zonedDayHourToUtc(
    userToday(timezone),
    SEED_START_HOUR,
    timezone,
  ).toISOString();

  const taskInputs: CreateTaskInput[] = plan.tasks.map((t) =>
    toCreateTaskInput(systemId, undefined, t, todayStartISO),
  );
  const pending: Array<{ folderId: string; title: string; content: string | null }> = [];

  for (const folder of plan.folders) {
    const created = await createFolder(userId, {
      systemId,
      name: folder.name,
      ...(folder.metadata ? { metadata: folder.metadata } : {}),
    });
    for (const task of folder.tasks) {
      taskInputs.push(toCreateTaskInput(systemId, created.id, task, todayStartISO));
    }
    if (folder.page) {
      pending.push({ folderId: created.id, title: folder.page.title, content: folder.page.content });
    }
  }

  if (taskInputs.length > 0) {
    await bulkCreateTasks(userId, taskInputs);
  }

  for (const page of pending) {
    try {
      await createPage(userId, {
        systemId,
        folderId: page.folderId,
        title: page.title,
        content: page.content,
      });
    } catch (err) {
      console.error('onboarding seed page failed', { systemId, folderId: page.folderId, err });
    }
  }
}

export async function completeOnboarding(
  userId: string,
  input: SetupProfileInput,
) {
  const archetype = getArchetype(input.identity);

  await insertEnergyProfile(userId, input);

  // La timezone se guarda antes de sembrar: `createTask` deriva el status de
  // scheduling leyendo la del usuario, y con la vieja una tarea de hoy podría
  // nacer con el día cambiado.
  if (input.timezone) await saveUserTimezone(userId, input.timezone);
  const timezone = input.timezone ?? (await getUserTimezone(userId));

  const energyIdeal = archetypeEnergyIdeal(archetype);
  const system = await createSystem(userId, {
    name: input.firstSystemName,
    color: archetype.systemColor,
    icon: archetype.systemIcon,
    templateType: archetype.systemType,
    ...(energyIdeal ? { energyIdeal } : {}),
    ...(archetype.identityStatement ? { identityStatement: archetype.identityStatement } : {}),
  });

  // La siembra es el valor del onboarding segmentado, pero no su condición: si
  // algo falla creando el contenido de ejemplo, el usuario igual entra con su
  // perfil de energía y su sistema — no se queda atrapado en el wizard.
  if (system) {
    try {
      await applySeedPlan(
        userId,
        system.id,
        buildSeedPlan(input.identity, input.firstSystemName, input.seedUnits),
        timezone,
      );
    } catch (err) {
      console.error('onboarding seed failed', { userId, systemId: system.id, err });
    }
  }

  await saveArchetypeIdentity(userId, input.identity);
  await markOnboardingComplete(userId);
}
