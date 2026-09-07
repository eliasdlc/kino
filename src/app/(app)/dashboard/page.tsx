import { redirect } from "next/navigation";
import { api } from "@convex/_generated/api";
import { serverQuery } from "@/shared/convex/server";
import { toTransport } from "@/shared/lib/transport";
import { TodayPlanCard } from "@/features/dashboard/TodayPlanCard";
import { EnergyTodayCard } from "@/features/dashboard/EnergyTodayCard";
import { AdvisorCard } from "@/features/dashboard/AdvisorCard";
import { FocusNowCard } from "@/features/dashboard/FocusNowCard";
import { NotificationPromptCard } from "@/features/dashboard/NotificationPromptCard";
import { WeeklyRitualPrompt } from "@/features/energy/WeeklyRitualPrompt";
import { DashboardBottomRow } from "@/features/dashboard/DashboardBottomRow";
import { getServerSession } from "@/shared/utils/session";

export const metadata = { title: "Hoy - Kino" };

/**
 * Hoy es la cota: la cifra del día y su frase primero, la curva debajo, el
 * check-in en línea, el presupuesto como barra fina, y el plan como lista de
 * dos niveles. Los avisos son una línea al pie, nunca una tarjeta antes de la
 * cifra, y nada vacío ocupa espacio. En laptop la energía va a la izquierda y
 * el plan a la derecha; en el teléfono es la misma pantalla, estrecha.
 */
export default async function DashboardPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");

  const [dailyPlan, topPattern, weeklyTrends, learningInsight] = await Promise.all([
    serverQuery(api.energy.todayPlan, {}),
    serverQuery(api.energy.advisor, {}),
    serverQuery(api.energy.weeklyTrends, {}),
    serverQuery(api.energy.learningInsight, {}),
  ]);

  const energyItems = toTransport(dailyPlan.energyPlan?.items);

  return (
    <div className="mx-auto max-w-6xl px-5 py-5 md:px-8 md:py-6">
      <div className="md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] md:gap-10">
        <section aria-label="Energía de hoy" className="md:border-r md:border-border md:pr-10">
          <EnergyTodayCard
            initialCheckins={dailyPlan.checkins}
            projectedCurve={dailyPlan.projectedCurve}
            chronotype={dailyPlan.chronotype}
            predictions={dailyPlan.predictions}
          />
        </section>

        <div className="mt-8 flex flex-col gap-6 md:mt-0">
          <TodayPlanCard noProfile={dailyPlan.noProfile} energyItems={energyItems} />

          {topPattern ? (
            <AdvisorCard
              pattern={topPattern}
              actionTaskIds={topPattern.actionTaskIds}
              actionLabel={topPattern.actionLabel}
              bulkAction={topPattern.bulkAction}
            />
          ) : (
            <FocusNowCard energyItems={energyItems} projectedCurve={dailyPlan.projectedCurve} />
          )}

          <WeeklyRitualPrompt />
          <DashboardBottomRow weeklyTrends={weeklyTrends} insight={learningInsight} />
          <NotificationPromptCard />
        </div>
      </div>
    </div>
  );
}
