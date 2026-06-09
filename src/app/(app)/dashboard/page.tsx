import { auth } from "@/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getTodayEnergyPlan, getTodayAdvisor, getWeeklyTrends } from "@/features/energy/energy.service";
import { TodayPlanCard } from "@/features/dashboard/TodayPlanCard";
import { EnergyBatteryCard } from "@/features/dashboard/EnergyBatteryCard";
import { AdvisorCard } from "@/features/dashboard/AdvisorCard";
import { NotificationPromptCard } from "@/features/dashboard/NotificationPromptCard";
import { DashboardBottomRow } from "@/features/dashboard/DashboardBottomRow";

export const metadata = { title: "Dashboard - Kino" };

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const userId = session.user.id;

  const [dailyPlan, topPattern, weeklyTrends] = await Promise.all([
    getTodayEnergyPlan(userId),
    getTodayAdvisor(userId),
    getWeeklyTrends(userId),
  ]);

  return (
    <div className="h-full overflow-hidden p-3 md:p-4">
      <NotificationPromptCard />

      <div className="dashboard-grid h-full">
        {/* ── Plan de hoy — client component, fetches its own tasks ── */}
        <div className="dashboard-plan overflow-hidden">
          <TodayPlanCard
            noProfile={dailyPlan.noProfile}
            energyItems={dailyPlan.energyPlan?.items}
          />
        </div>

        {/* ── Panel derecho: Energía + Advisor ── */}
        <div className="dashboard-side flex flex-col gap-3 overflow-y-auto">
          <EnergyBatteryCard
            initialCheckins={dailyPlan.checkins}
            projectedCurve={dailyPlan.energyPlan?.projectedCurve ?? null}
            chronotype={dailyPlan.chronotype}
            scheduledItems={dailyPlan.energyPlan?.items}
            deferredTasks={dailyPlan.energyPlan?.deferred}
          />
          {topPattern && (
            <AdvisorCard
              pattern={topPattern}
              actionTaskIds={topPattern.actionTaskIds}
              actionLabel={topPattern.actionLabel}
              bulkAction={topPattern.bulkAction}
            />
          )}
        </div>

        {/* ── Fila inferior ── */}
        <div className="dashboard-bottom">
          <DashboardBottomRow
            weeklyTrends={weeklyTrends}
            learnedCurve={dailyPlan.learnedCurve}
            learningAlpha={dailyPlan.learningAlpha}
            chronotype={dailyPlan.chronotype}
          />
        </div>
      </div>
    </div>
  );
}
