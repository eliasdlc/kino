import { redirect } from "next/navigation";
import { getTodayEnergyPlan, getTodayAdvisor, getWeeklyTrends, getLearningInsight } from "@/features/energy/energy.service";
import { TodayPlanCard } from "@/features/dashboard/TodayPlanCard";
import dynamic from "next/dynamic";

const EnergyTodayCard = dynamic(
  () => import("@/features/dashboard/EnergyTodayCard").then((m) => m.EnergyTodayCard),
  {
    loading: () => (
      <div className="rounded-xl border bg-card overflow-hidden animate-pulse">
        <div className="px-5 py-3 border-b">
          <div className="h-4 w-32 bg-muted rounded" />
        </div>
        <div className="px-5 py-3.5 space-y-3.5">
          <div className="flex gap-3">
            <div className="w-[68px] h-[68px] bg-muted rounded-xl" />
            <div className="flex-1 space-y-2 py-1">
              <div className="h-4 w-3/4 bg-muted rounded" />
              <div className="h-3 w-1/2 bg-muted rounded" />
            </div>
          </div>
          <div className="h-[76px] w-full bg-muted rounded" />
          <div className="flex gap-1.5">
            <div className="flex-1 h-7 bg-muted rounded-md" />
            <div className="flex-1 h-7 bg-muted rounded-md" />
            <div className="flex-1 h-7 bg-muted rounded-md" />
          </div>
        </div>
      </div>
    ),
  },
);
import { AdvisorCard } from "@/features/dashboard/AdvisorCard";
import { FocusNowCard } from "@/features/dashboard/FocusNowCard";
import { NotificationPromptCard } from "@/features/dashboard/NotificationPromptCard";
import { WeeklyRitualPrompt } from "@/features/energy/WeeklyRitualPrompt";
import { DashboardBottomRow } from "@/features/dashboard/DashboardBottomRow";
import { getServerSession } from "@/shared/utils/session";
import { toTransport } from "@/shared/api/transport";

export const metadata = { title: "Inicio - Kino" };

export default async function DashboardPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");

  const userId = session.user.id;

  const [dailyPlan, topPattern, weeklyTrends, learningInsight] = await Promise.all([
    getTodayEnergyPlan(userId),
    getTodayAdvisor(userId),
    getWeeklyTrends(userId),
    getLearningInsight(userId),
  ]);

  return (
    <div className="md:h-full md:overflow-hidden p-3 md:p-4">
      <NotificationPromptCard />
      <WeeklyRitualPrompt />

      <div className="dashboard-grid h-full">
        {/* ── Plan de hoy — client component, fetches its own tasks ── */}
        <div className="dashboard-plan overflow-hidden motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:duration-500 motion-safe:fill-mode-both">
          <TodayPlanCard
            noProfile={dailyPlan.noProfile}
            energyItems={toTransport(dailyPlan.energyPlan?.items)}
          />
        </div>

        {/* ── Panel derecho: Energía + (Advisor | Enfoque) ── */}
        <div
          className="dashboard-side flex flex-col gap-3 min-h-0 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:duration-500 motion-safe:fill-mode-both"
          style={{ animationDelay: "80ms" }}
        >
          <EnergyTodayCard
            initialCheckins={toTransport(dailyPlan.checkins)}
            projectedCurve={dailyPlan.projectedCurve}
            chronotype={dailyPlan.chronotype}
            predictions={dailyPlan.predictions}
          />
          <div className="flex-1 min-h-0">
            {topPattern ? (
              <AdvisorCard
                pattern={topPattern}
                actionTaskIds={topPattern.actionTaskIds}
                actionLabel={topPattern.actionLabel}
                bulkAction={topPattern.bulkAction}
              />
            ) : (
              <FocusNowCard
                energyItems={toTransport(dailyPlan.energyPlan?.items)}
                projectedCurve={dailyPlan.projectedCurve}
              />
            )}
          </div>
        </div>

        {/* ── Fila inferior ── */}
        <div
          className="dashboard-bottom motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:duration-500 motion-safe:fill-mode-both"
          style={{ animationDelay: "160ms" }}
        >
          <DashboardBottomRow weeklyTrends={weeklyTrends} insight={learningInsight} />
        </div>
      </div>
    </div>
  );
}
