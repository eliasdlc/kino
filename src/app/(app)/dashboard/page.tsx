import { auth } from "@/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/shared/db";
import { tasks, userSettings } from "@/shared/db/schema";
import { and, eq, isNull, sql } from "drizzle-orm";
import { Progress } from "@/components/ui/progress";

export const metadata = { title: "Dashboard - Kino" };

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const userId = session.user.id;

  const [energyData] = await db
    .select({ total: sql<number>`COALESCE(SUM(${tasks.energyPoints}), 0)` })
    .from(tasks)
    .where(and(eq(tasks.userId, userId), eq(tasks.status, "today"), isNull(tasks.deletedAt)));

  const [settings] = await db
    .select({ dailyEnergyLimit: userSettings.dailyEnergyLimit })
    .from(userSettings)
    .where(eq(userSettings.userId, userId));

  const usedEnergy = energyData?.total ?? 0;
  const limit = settings?.dailyEnergyLimit ?? 50;
  const percentage = Math.round((usedEnergy / limit) * 100);

  const todayTasks = await db.select()
    .from(tasks)
    .where(and(eq(tasks.userId, userId), eq(tasks.status, "today"), isNull(tasks.deletedAt)))
    .orderBy(tasks.sortIndex);

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-3xl font-bold">
          Buenos días, {session.user.name}
        </h1>
        <p className="text-muted-foreground mt-1">
          {new Date().toLocaleDateString("es-ES", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </p>
      </div>

      <div className="rounded-lg border p-6 space-y-4 bg-card">
        <div className="space-y-2">
          <h2 className="text-lg font-semibold">Energía de hoy</h2>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-bold">{usedEnergy}</span>
            <span className="text-muted-foreground">/ {limit}</span>
          </div>
        </div>
        <div className="space-y-2">
          <Progress value={percentage} className="h-2" />
          <p className="text-xs text-muted-foreground">
            {percentage}% de tu energía diaria
          </p>
        </div>
      </div>

      <div className="rounded-lg border p-6 space-y-4 bg-card">
        <h2 className="text-lg font-semibold">Tareas de hoy</h2>
        {todayTasks.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">
            No hay tareas programadas para hoy. ¡Descansa o planifica el día!
          </p>
        ) : (
          <ul className="space-y-3">
            {todayTasks.map((task) => (
              <li
                key={task.id}
                className="flex items-start gap-3 p-3 rounded-md hover:bg-accent/50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{task.title}</p>
                  {task.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                      {task.description}
                    </p>
                  )}
                </div>
                <span className="text-xs font-medium whitespace-nowrap text-muted-foreground bg-muted px-2 py-1 rounded">
                  {task.energyPoints} EP
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-lg border p-6 bg-card/50 space-y-2">
        <p className="text-sm text-muted-foreground">
          💡 Esta es una vista simplificada. En futuras fases tendrás acceso a Smart View,
          análisis de energía, brain dump, y mucho más.
        </p>
      </div>
    </div>
  );
}
