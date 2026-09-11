import { convexTest } from 'convex-test';
import { describe, expect, it } from 'vitest';
import { ENERGY_PROFILE_DEFAULTS } from '../src/features/onboarding/onboarding.schemas';
import { api } from './_generated/api';
import schema from './schema';

/**
 * El alta de dos pantallas y una pregunta. Lo que estas pruebas fijan es que la
 * única pregunta es el arquetipo: todo lo demás (perfil de energía, nombre del
 * sistema, versión del camino) lo escribe el servidor con un valor declarado, y
 * una cuenta de la versión anterior no se toca.
 */

const modules = import.meta.glob('./**/*.*s');
const ana = { subject: 'user_ana', email: 'ana@usekino.dev', name: 'Ana' };

async function nuevaCuenta() {
  const t = convexTest(schema, modules);
  const asAna = t.withIdentity(ana);
  const userId = await asAna.mutation(api.users.ensure, {});
  return { t, asAna, userId };
}

describe('onboarding.complete', () => {
  it('escribe el perfil de energía con sus defaults sin haber preguntado nada', async () => {
    const { t, asAna, userId } = await nuevaCuenta();

    await asAna.mutation(api.onboarding.complete, { identity: 'escritor' });

    const profile = await t.run((ctx) =>
      ctx.db
        .query('userEnergyProfile')
        .withIndex('by_user', (q) => q.eq('userId', userId))
        .unique(),
    );
    expect(profile?.chronotype).toBe(ENERGY_PROFILE_DEFAULTS.chronotype);
    expect(profile?.sleepTypicalHours).toBe(ENERGY_PROFILE_DEFAULTS.sleepTypicalHours);
    expect(profile?.availableHoursPerDay).toBe(ENERGY_PROFILE_DEFAULTS.availableHoursPerDay);
  });

  it('nombra el primer sistema con el del arquetipo cuando nadie escribió uno', async () => {
    const { t, asAna, userId } = await nuevaCuenta();

    await asAna.mutation(api.onboarding.complete, { identity: 'escritor' });

    const systems = await t.run((ctx) =>
      ctx.db
        .query('systems')
        .withIndex('by_user_inbox', (q) => q.eq('userId', userId))
        .collect(),
    );
    expect(systems.find((s) => !s.isInbox)?.name).toBe('Escritura');
  });

  it('no adivina en qué trabaja quien eligió "ninguna de las anteriores"', async () => {
    const { t, asAna, userId } = await nuevaCuenta();

    await asAna.mutation(api.onboarding.complete, { identity: 'propio' });

    const systems = await t.run((ctx) =>
      ctx.db
        .query('systems')
        .withIndex('by_user_inbox', (q) => q.eq('userId', userId))
        .collect(),
    );
    expect(systems.find((s) => !s.isInbox)?.name).toBe('Mi sistema');
  });

  it('marca la cuenta con la versión 2 del camino de entrada', async () => {
    const { t, asAna, userId } = await nuevaCuenta();

    await asAna.mutation(api.onboarding.complete, { identity: 'estudiante' });

    const settings = await t.run((ctx) =>
      ctx.db
        .query('userSettings')
        .withIndex('by_user', (q) => q.eq('userId', userId))
        .unique(),
    );
    expect(settings?.onboardingVersion).toBe(2);
    expect(settings?.archetypeIdentity).toBe('estudiante');
  });

  it('deja intacta una cuenta que ya pasó por el wizard de ocho pasos', async () => {
    const { t, asAna, userId } = await nuevaCuenta();
    await t.run(async (ctx) => {
      await ctx.db.insert('userSettings', {
        userId,
        onboardingVersion: 1,
        archetypeIdentity: 'builder',
        weeklyReviewDay: 'sun',
        dailyResetTime: '00:00',
        dailyEnergyLimit: 50,
        focusTimeoutHours: 3,
        theme: 'system',
        notificationsEnabled: true,
        createdAt: 1,
        updatedAt: 1,
      });
      await ctx.db.patch(userId, { onboardingCompleted: true });
    });

    // La versión anterior sigue siendo la suya: nada la migra y nada la vuelve
    // a mandar al alta, así que no ve ningún paso repetido.
    expect(await asAna.query(api.onboarding.status, {})).toEqual({ completed: true });
    const settings = await t.run((ctx) =>
      ctx.db
        .query('userSettings')
        .withIndex('by_user', (q) => q.eq('userId', userId))
        .unique(),
    );
    expect(settings?.onboardingVersion).toBe(1);
  });

  it('siembra contenido real: la cuenta aterriza en Hoy con algo que hacer', async () => {
    const { t, asAna, userId } = await nuevaCuenta();

    await asAna.mutation(api.onboarding.complete, { identity: 'estudiante' });

    const tasks = await t.run((ctx) =>
      ctx.db
        .query('tasks')
        .withIndex('by_user_alive_status', (q) => q.eq('userId', userId).eq('deletedAt', undefined))
        .collect(),
    );
    expect(tasks.length).toBeGreaterThan(0);
    // Como mucho una estrena el día: el primer día no puede ser una lista que
    // ya llega imposible.
    expect(tasks.filter((task) => task.startDate).length).toBe(1);
  });
});
