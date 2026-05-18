import { auth } from "@/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/shared/db";
import { tasks } from "@/shared/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { PageWrapper } from "@/components/PageWrapper";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

export const metadata = { title: "Dashboard - Kino" };

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const userId = session.user.id;

  const todayTasks = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.userId, userId), eq(tasks.status, "today"), isNull(tasks.deletedAt)))
    .orderBy(tasks.sortIndex);

  const doneTodayCount = todayTasks.filter((t) => t.status === "done").length;

  return (
    <PageWrapper>
      {/* Greeting */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Hey, {session.user.name?.split(" ")[0]}
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

      {/* Today's tasks */}
      <div className="rounded-lg border bg-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Today&apos;s tasks</h2>
          {todayTasks.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {doneTodayCount}/{todayTasks.length} done
            </span>
          )}
        </div>
        {todayTasks.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">
            No tasks with status <strong>Today</strong> right now. Open a system and move tasks here.
          </p>
        ) : (
          <ul className="space-y-1">
            {todayTasks.map((task) => (
              <li
                key={task.id}
                className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-accent/50 transition-colors"
              >
                <div
                  className={`size-3 rounded-full shrink-0 border-2 ${
                    task.status === "done"
                      ? "bg-green-500 border-green-500"
                      : "border-muted-foreground/40"
                  }`}
                />
                <p className={`text-sm flex-1 truncate ${task.status === "done" ? "line-through text-muted-foreground" : ""}`}>
                  {task.title}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Quick links */}
      <div className="rounded-lg border bg-card p-6 space-y-3">
        <h2 className="text-lg font-semibold">Quick access</h2>
        <div className="space-y-1">
          <Link
            href="/systems"
            className="flex items-center justify-between px-3 py-2.5 rounded-md hover:bg-accent/50 transition-colors text-sm"
          >
            <span>All systems</span>
            <ChevronRight className="size-4 text-muted-foreground" />
          </Link>
        </div>
      </div>
    </PageWrapper>
  );
}
