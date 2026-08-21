import { NextResponse } from 'next/server';
import { z } from 'zod';
import { route } from '@/shared/utils/route';
import { NotFoundError } from '@/shared/utils/error';
import {
  createCheckinSchema,
  updateCheckinAccuracySchema,
  scheduleBlockSchema,
  blockProposalQuerySchema,
  applyRitualSchema,
} from './energy.schemas';
import {
  createTodayCheckin,
  getTodayCheckins,
  getTodayEnergyPlan,
  updatePredictionAccuracy,
} from './energy.service';
import {
  getEnergyWindows,
  proposeDayBlocks,
  scheduleTaskBlock,
  clearTaskBlock,
  getWeeklyRitual,
  applyWeeklyRitual,
} from './energy.blocks';

export const createCheckinRoute = route()(
  { body: createCheckinSchema },
  async ({ userId, body }) =>
    NextResponse.json(await createTodayCheckin(userId, body), { status: 201 }),
);

export const getTodayCheckinsRoute = route()({}, async ({ userId }) =>
  NextResponse.json(await getTodayCheckins(userId)),
);

export const updateCheckinAccuracyRoute = route()(
  { body: updateCheckinAccuracySchema },
  async ({ userId, body }) => {
    const updated = await updatePredictionAccuracy(userId, body);
    if (!updated) throw new NotFoundError('No checkin found for this slot');
    return NextResponse.json(updated);
  },
);

export const getTodayPlanRoute = route()({}, async ({ userId }) =>
  NextResponse.json(await getTodayEnergyPlan(userId)),
);

// ── Time-blocking (Fase 4.3) ───────────────────────────────────────────────

/**
 * Sin perfil de energía no hay ventanas que proponer. Es un 404 con code
 * propio, no un NotFoundError, porque la UI lo distingue de "no existe" para
 * ofrecer configurar el perfil.
 */
const NO_PROFILE = {
  code: 'NO_PROFILE',
  message: 'El usuario no tiene perfil de energía configurado todavía',
} as const;

export const getEnergyWindowsRoute = route()({}, async ({ userId }) => {
  const windows = await getEnergyWindows(userId);
  if (!windows) return NextResponse.json(NO_PROFILE, { status: 404 });
  return NextResponse.json(windows);
});

export const getBlockProposalRoute = route()(
  { query: blockProposalQuerySchema },
  async ({ userId, query }) => {
    const proposal = await proposeDayBlocks(userId, query.date, query.startHour);
    if (!proposal) return NextResponse.json(NO_PROFILE, { status: 404 });
    return NextResponse.json(proposal);
  },
);

export const scheduleBlockRoute = route()(
  { body: scheduleBlockSchema },
  async ({ userId, body }) =>
    NextResponse.json(await scheduleTaskBlock(userId, body.taskId, body.date, body.hour)),
);

export const clearBlockRoute = route()(
  { query: z.object({ taskId: z.string().min(1, 'Falta el parámetro taskId') }) },
  async ({ userId, query }) => NextResponse.json(await clearTaskBlock(userId, query.taskId)),
);

// ── Ritual de revisión semanal (Fase 4.4) ──────────────────────────────────

export const getWeeklyRitualRoute = route()({}, async ({ userId }) =>
  NextResponse.json(await getWeeklyRitual(userId)),
);

export const applyWeeklyRitualRoute = route()(
  { body: applyRitualSchema },
  async ({ userId, body }) =>
    NextResponse.json(await applyWeeklyRitual(userId, body.assignments)),
);
