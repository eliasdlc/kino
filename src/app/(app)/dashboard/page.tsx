import { auth } from "@/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/shared/db";
import { tasks, systems } from "@/shared/db/schema";
import { and, eq, isNull, sql } from "drizzle-orm";
import { cn } from "@/lib/utils";
import { getTodayEnergyPlan, getTodayAdvisor, getWeeklyTrends } from "@/features/energy/energy.service";
import { TodayPlanCard } from "@/features/dashboard/TodayPlanCard";
import { EnergyBatteryCard } from "@/features/dashboard/EnergyBatteryCard";
import { AdvisorCard } from "@/features/dashboard/AdvisorCard";
import { WeeklyTrendsCard } from "@/features/dashboard/WeeklyTrendsCard";
import { QuickAccessCard } from "@/features/dashboard/QuickAccessCard";

export const metadata = { title: "Dashboard - Kino" };

const PRIORITY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
const ENERGY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const userId = session.user.id;

  const [todayTasksRaw, userSystems, dailyPlan, topPattern, weeklyTrends] = await Promise.all([
    db
      .select()
      .from(tasks)
      .where(and(
        eq(tasks.userId, userId),
        sql`${tasks.status} IN ('today', 'done')`,
        isNull(tasks.deletedAt),
        isNull(tasks.parentTaskId),
      ))
      .orderBy(tasks.sortIndex),
    db
      .select({ id: systems.id, name: systems.name, color: systems.color, icon: systems.icon })
      .from(systems)
      .where(eq(systems.userId, userId)),
    getTodayEnergyPlan(userId),
    getTodayAdvisor(userId),
    getWeeklyTrends(userId),
  ]);

  const doneTasks = todayTasksRaw.filter((t) => t.status === "done");
  const pendingTasks = todayTasksRaw
    .filter((t) => t.status === "today")
    .sort((a, b) => {
      const pDiff = (PRIORITY_ORDER[a.priority] ?? 2) - (PRIORITY_ORDER[b.priority] ?? 2);
      if (pDiff !== 0) return pDiff;
      return (ENERGY_ORDER[a.energyLevel] ?? 1) - (ENERGY_ORDER[b.energyLevel] ?? 1);
    });

  const totalToday = todayTasksRaw.length;
  const doneCount = doneTasks.length;

  const firstName = session.user.name?.split(" ")[0] ?? "there";
  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Buenos días";
    if (h < 17) return "Buenas tardes";
    return "Buenas noches";
  })();

  const hasWeeklyData = weeklyTrends.snapshots.length > 0 || weeklyTrends.checkins.length > 0;

  return (
    <div className="p-6 space-y-4 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {greeting}, {firstName}
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {new Date().toLocaleDateString("es-ES", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </p>
      </div>

      {/* Bento grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* ── Plan de hoy — celda grande (2 cols, toda la altura izquierda) ── */}
        <div className="lg:col-span-2 lg:row-span-2 min-h-[420px]">
          <TodayPlanCard
            pendingTasks={pendingTasks}
            doneCount={doneCount}
            totalToday={totalToday}
            noProfile={dailyPlan.noProfile}
            energyItems={dailyPlan.energyPlan?.items}
          />
        </div>

        {/* ── Columna derecha — apila Energía + Consejero ── */}
        <div className="flex flex-col gap-4">
          <EnergyBatteryCard
            initialCheckin={dailyPlan.checkin}
            projectedCurve={dailyPlan.energyPlan?.projectedCurve ?? null}
            chronotype={dailyPlan.chronotype}
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
        {hasWeeklyData && <WeeklyTrendsCard trends={weeklyTrends} />}

        <div className={cn(hasWeeklyData ? "lg:col-span-2" : "lg:col-span-3")}>
          <QuickAccessCard systems={userSystems} />
        </div>
      </div>
    </div>
  );
}
