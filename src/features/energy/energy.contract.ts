import { z } from "zod";
import { endpoint, output } from "@/shared/api/contract";
import {
  applyRitualSchema,
  blockProposalQuerySchema,
  createCheckinSchema,
  scheduleBlockSchema,
  updateCheckinAccuracySchema,
} from "./energy.schemas";
import type {
  createTodayCheckin,
  getTodayAdvisor,
  getTodayCheckins,
  getTodayEnergyPlan,
  updatePredictionAccuracy,
} from "./energy.service";
import type {
  clearTaskBlock,
  getEnergyWindows,
  getWeeklyRitual,
  proposeDayBlocks,
  scheduleTaskBlock,
  applyWeeklyRitual,
} from "./energy.blocks";

/**
 * Varias de estas operaciones devuelven un tipo que el servicio infiere en vez
 * de declarar. `Awaited<ReturnType<…>>` lo toma de ahí en lugar de repetirlo:
 * si el servicio cambia lo que devuelve, el contrato cambia con él.
 */
type Returns<T extends (...args: never[]) => unknown> = Awaited<ReturnType<T>>;

export const energyContract = {
  checkins: endpoint
    .route({ method: "GET", path: "/energy/checkin" })
    .output(output<Returns<typeof getTodayCheckins>>()),

  createCheckin: endpoint
    .route({ method: "POST", path: "/energy/checkin", successStatus: 201 })
    .input(createCheckinSchema)
    .output(output<Returns<typeof createTodayCheckin>>()),

  updateAccuracy: endpoint
    .route({ method: "PATCH", path: "/energy/checkin" })
    .input(updateCheckinAccuracySchema)
    .output(output<NonNullable<Returns<typeof updatePredictionAccuracy>>>()),

  advisor: endpoint
    .route({ method: "GET", path: "/energy/advisor" })
    .output(output<Returns<typeof getTodayAdvisor>>()),

  todayPlan: endpoint
    .route({ method: "GET", path: "/energy/plan/today" })
    .output(output<Returns<typeof getTodayEnergyPlan>>()),

  windows: endpoint
    .route({ method: "GET", path: "/energy/windows" })
    .output(output<NonNullable<Returns<typeof getEnergyWindows>>>()),

  blockProposal: endpoint
    .route({ method: "GET", path: "/energy/blocks" })
    .input(blockProposalQuerySchema)
    .output(output<NonNullable<Returns<typeof proposeDayBlocks>>>()),

  scheduleBlock: endpoint
    .route({ method: "POST", path: "/energy/blocks" })
    .input(scheduleBlockSchema)
    .output(output<Returns<typeof scheduleTaskBlock>>()),

  clearBlock: endpoint
    .route({ method: "DELETE", path: "/energy/blocks" })
    .input(z.object({ taskId: z.string().min(1, "Falta el parámetro taskId") }))
    .output(output<Returns<typeof clearTaskBlock>>()),

  weeklyRitual: endpoint
    .route({ method: "GET", path: "/rituals/weekly" })
    .output(output<Returns<typeof getWeeklyRitual>>()),

  applyWeeklyRitual: endpoint
    .route({ method: "POST", path: "/rituals/weekly" })
    .input(applyRitualSchema)
    .output(output<Returns<typeof applyWeeklyRitual>>()),
};
