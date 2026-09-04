import type { FunctionReturnType } from "convex/server";
import type { api } from "@convex/_generated/api";

// Las formas que el dashboard pinta, derivadas de lo que Convex devuelve.

export type TodayEnergyPlan = FunctionReturnType<typeof api.energy.todayPlan>;
export type PredictionRow = TodayEnergyPlan["predictions"][number];
export type TodayCheckinRowTransport = TodayEnergyPlan["checkins"][number];
export type LearningInsight = FunctionReturnType<typeof api.energy.learningInsight>;
export type WeeklyTrend = FunctionReturnType<typeof api.energy.weeklyTrends>;
export type TodayAdvisor = FunctionReturnType<typeof api.energy.advisor>;
export type { AdvisorBulkAction } from "@convex/energy";
