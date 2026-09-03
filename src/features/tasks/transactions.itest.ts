import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '@/shared/db';
import { taskReminders, tasks } from '@/shared/db/schema';
import { resetAndSeedActors, type Actors } from '@/shared/db/testing/harness';
import { createSystem } from '@/features/systems/systems.service';
import { createFolder } from '@/features/folders/folders.service';
import { bulkCreateTasks, queryTasks } from '@/features/tasks/tasks.service';

/**
 * `bulkCreateTasks` mete el lote entero en una transacción para que un item malo
 * a mitad no deje medio lote escrito. Es una garantía que sólo existe si la base
 * revierte de verdad: con `db` mockeado, `tx` es el mismo objeto falso y el
 * rollback nunca se ejerce.
 *
 * Una tarea `critical` con fecha escribe además sus recordatorios automáticos en
 * otra tabla dentro de la misma transacción, así que sirve para preguntar lo que
 * importa: que al revertir no quede rastro en ninguna de las dos.
 */

let actors: Actors;
let systemId: string;

beforeEach(async () => {
  actors = await resetAndSeedActors();
  systemId = (await createSystem(actors.alice, { name: 'Tesis', color: 'blue', icon: 'folder' }))!.id;
});

/** Lejos para que los recordatorios de 7 y 3 días caigan en el futuro. */
const dueDate = () => new Date(Date.now() + 30 * 86_400_000).toISOString();

const remindersOf = (userId: string) =>
  db.select().from(taskReminders).where(eq(taskReminders.userId, userId));

describe('transacciones · bulkCreateTasks', () => {
  it('un lote entero se escribe, con los recordatorios que arrastra', async () => {
    const created = await bulkCreateTasks(actors.alice, [
      { systemId, title: 'Marco teórico' },
      { systemId, title: 'Defensa', priority: 'critical', dueDate: dueDate() },
    ]);

    expect(created).toHaveLength(2);
    expect(await queryTasks(actors.alice, {})).toHaveLength(2);
    // critical → recordatorios a 7 y a 3 días.
    expect(await remindersOf(actors.alice)).toHaveLength(2);
  });

  it('un item malo a mitad no deja nada escrito, ni la tarea buena ni sus recordatorios', async () => {
    const bobSystem = (await createSystem(actors.bob, { name: 'De Bob', color: 'red', icon: 'folder' }))!;
    const carpetaAjena = await createFolder(actors.bob, { name: 'Suya', systemId: bobSystem.id });

    await expect(
      bulkCreateTasks(actors.alice, [
        { systemId, title: 'Defensa', priority: 'critical', dueDate: dueDate() },
        { systemId, title: 'Con carpeta ajena', folderId: carpetaAjena.id },
        { systemId, title: 'Nunca llega' },
      ]),
    ).rejects.toThrow();

    expect(await queryTasks(actors.alice, {})).toEqual([]);
    expect(await remindersOf(actors.alice)).toEqual([]);
  });

  it('lo que ya había antes del lote fallido sigue intacto', async () => {
    const bobSystem = (await createSystem(actors.bob, { name: 'De Bob', color: 'red', icon: 'folder' }))!;
    await bulkCreateTasks(actors.alice, [{ systemId, title: 'Marco teórico' }]);

    await expect(
      bulkCreateTasks(actors.alice, [
        { systemId, title: 'Segunda tanda' },
        { systemId: bobSystem.id, title: 'Sistema ajeno' },
      ]),
    ).rejects.toThrow();

    const remaining = await db
      .select({ title: tasks.title })
      .from(tasks)
      .where(eq(tasks.userId, actors.alice));
    expect(remaining.map((t) => t.title)).toEqual(['Marco teórico']);
  });
});
