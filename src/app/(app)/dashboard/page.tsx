import { auth } from "@/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getTodayEnergyPlan, getTodayAdvisor, getWeeklyTrends } from "@/features/energy/energy.service";
import { TodayPlanCard } from "@/features/dashboard/TodayPlanCard";
import dynamic from "next/dynamic";

const EnergyBatteryCard = dynamic(
  () => import("@/features/dashboard/EnergyBatteryCard").then((m) => m.EnergyBatteryCard),
  {
    loading: () => (
      <div className="rounded-xl border bg-card overflow-hidden animate-pulse">
        <div className="px-5 py-4 border-b">
          <div className="h-4 w-32 bg-muted rounded" />
        </div>
        <div className="px-5 py-4 space-y-3">
          <div className="h-[72px] w-full bg-muted rounded" />
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
import { NotificationPromptCard } from "@/features/dashboard/NotificationPromptCard";
import { DashboardBottomRow } from "@/features/dashboard/DashboardBottomRow";

export const metadata = { title: "Inicio - Kino" };

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
