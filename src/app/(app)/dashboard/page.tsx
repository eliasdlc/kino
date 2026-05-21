import { auth } from "@/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/shared/db";
import { tasks, systems } from "@/shared/db/schema";
import { and, eq, isNull, sql } from "drizzle-orm";
import { PageWrapper } from "@/components/PageWrapper";
import Link from "next/link";
import { ChevronRight, Zap, Flame, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { getTodayEnergyPlan, getTodayAdvisor } from "@/features/energy/energy.service";
import { DailyPlanCard } from "@/features/dashboard/DailyPlanCard";
import { EnergyBatteryCard } from "@/features/dashboard/EnergyBatteryCard";
import { AdvisorCard } from "@/features/dashboard/AdvisorCard";

export const metadata = { title: "Dashboard - Kino" };

const PRIORITY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
const ENERGY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };

function EnergyDot({ level }: { level: string }) {
  return (
    <span className={cn(
      "inline-flex size-1.5 rounded-full shrink-0",
      level === "high" ? "bg-amber-400" : level === "medium" ? "bg-sky-400" : "bg-zinc-500"
    )} />
  );
}

function PriorityIcon({ priority }: { priority: string }) {
  if (priority === "critical") return <Flame size={12} className="text-red-400 shrink-0" />;
  if (priority === "high") return <Zap size={12} className="text-orange-400 shrink-0" />;
  return <Minus size={12} className="text-zinc-600 shrink-0" />;
}

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const userId = session.user.id;

  const [todayTasksRaw, userSystems, dailyPlan, topPattern] = await Promise.all([
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
      .select({ id: systems.id, name: systems.name })
      .from(systems)
      .where(eq(systems.userId, userId)),
    getTodayEnergyPlan(userId),
    getTodayAdvisor(userId),
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
  const progressPct = totalToday > 0 ? Math.round((doneCount / totalToday) * 100) : 0;

  const firstName = session.user.name?.split(" ")[0] ?? "there";

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  })();

  return (
    <PageWrapper>
      {/* Greeting */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          {greeting}, {firstName}
        </h1>
        <p className="text-muted-foreground mt-1">
          {new Date().toLocaleDateString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </p>
      </div>

      {/* Smart View — what to do now */}
      <div className="rounded-lg border bg-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Today</h2>
            {totalToday > 0 && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {doneCount} of {totalToday} done
              </p>
            )}
          </div>
          {totalToday > 0 && (
            <span className="text-sm font-mono font-medium text-muted-foreground">
              {progressPct}%
            </span>
          )}
        </div>

        {/* Progress bar */}
        {totalToday > 0 && (
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full motion-safe:transition-all motion-safe:duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        )}

        {pendingTasks.length === 0 && doneCount === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-center space-y-3">
            <p className="text-sm text-muted-foreground">
              No tasks scheduled for today.{" "}
              <Link href="/systems" className="underline underline-offset-2 hover:text-foreground">
                Open a system
              </Link>{" "}
              or press <kbd className="font-sans px-1.5 py-0.5 border rounded-md text-xs">⌘+K</kbd> to jump to Inbox.
            </p>
          </div>
        ) : pendingTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-4 text-center space-y-1">
            <p className="text-sm font-medium text-emerald-500">All done for today!</p>
            <p className="text-xs text-muted-foreground">{doneCount} task{doneCount !== 1 ? "s" : ""} completed.</p>
          </div>
        ) : (
          <ul className="space-y-1.5">
            {pendingTasks.map((task, i) => (
              <li
                key={task.id}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg border",
                  i === 0
                    ? "border-emerald-500/30 bg-emerald-500/5"
                    : "border-transparent hover:bg-accent/40 motion-safe:transition-colors"
                )}
              >
                <PriorityIcon priority={task.priority} />
                <p className="text-sm flex-1 truncate">{task.title}</p>
                <EnergyDot level={task.energyLevel} />
                {i === 0 && (
                  <span className="text-[10px] font-mono font-semibold uppercase tracking-widest text-emerald-500 shrink-0">
                    start here
                  </span>
                )}
              </li>
            ))}

            {/* Completed tasks — collapsed summary */}
            {doneCount > 0 && (
              <li className="flex items-center gap-3 px-3 py-2 rounded-lg opacity-50">
                <span className="size-3 rounded-full bg-emerald-500/50 border border-emerald-500/70 shrink-0" />
                <p className="text-xs text-muted-foreground">
                  {doneCount} task{doneCount !== 1 ? "s" : ""} completed today
                </p>
              </li>
            )}
          </ul>
        )}
      </div>

      {/* Advisor */}
      <AdvisorCard pattern={topPattern} />

      {/* Energy Battery */}
      <EnergyBatteryCard
        initialCheckin={dailyPlan.checkin}
        projectedCurve={dailyPlan.energyPlan?.projectedCurve ?? null}
        chronotype={dailyPlan.chronotype}
      />

      {/* Daily Plan */}
      <DailyPlanCard
        plan={[]}
        noProfile={dailyPlan.noProfile}
        energyItems={dailyPlan.energyPlan?.items}
      />

      {/* Quick links */}
      <div className="rounded-lg border bg-card p-6 space-y-3">
        <h2 className="text-lg font-semibold">Quick access</h2>
        <div className="space-y-1">
          {userSystems.slice(0, 5).map((system) => (
            <Link
              key={system.id}
              href={`/systems/${system.id}`}
              className="flex items-center justify-between px-3 py-2.5 rounded-md hover:bg-accent/50 motion-safe:transition-colors text-sm"
            >
              <span>{system.name}</span>
              <ChevronRight className="size-4 text-muted-foreground" />
            </Link>
          ))}
          <Link
            href="/systems"
            className="flex items-center justify-between px-3 py-2.5 rounded-md hover:bg-accent/50 motion-safe:transition-colors text-sm text-muted-foreground"
          >
            <span>All systems</span>
            <ChevronRight className="size-4 text-muted-foreground" />
          </Link>
        </div>
      </div>
    </PageWrapper>
  );
}
