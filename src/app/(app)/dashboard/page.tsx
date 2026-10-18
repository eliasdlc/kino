import { redirect } from "next/navigation";
import { api } from "@convex/_generated/api";
import { serverQuery } from "@/shared/convex/server";
import { toTransport } from "@/shared/lib/transport";
import { TodayPlanCard } from "@/features/dashboard/TodayPlanCard";
import { EnergyTodayCard } from "@/features/dashboard/EnergyTodayCard";
import { AdvisorCard } from "@/features/dashboard/AdvisorCard";
import { OverBudgetExit } from "@/features/energy/OverBudgetExit";
import { CeilingMutedNotice } from "@/features/energy/CeilingMutedNotice";
import { FocusNowCard } from "@/features/dashboard/FocusNowCard";
import { InterruptionLine } from "@/features/today/InterruptionLine";
import { AgentActivityRow } from "@/features/today/AgentActivityRow";
import { ReturnNotice } from "@/features/today/ReturnNotice";
import { DashboardBottomRow } from "@/features/dashboard/DashboardBottomRow";
import { QuickAddFromUrl } from "@/features/tasks/QuickAddFromUrl";
import { getServerSession } from "@/shared/utils/session";
import { HOY_COLUMNS, HOY_ENERGY_COLUMN, HOY_PAGE, HOY_PLAN_COLUMN } from "@/features/dashboard/HoySkeleton";

export const metadata = { title: "Hoy - Kino" };

/**
 * Hoy es una página de Diario con la cota como cabecera: la cifra del día y
 * su frase primero, la curva debajo, el check-in en línea, el presupuesto como
 * barra fina, y el plan como filas de margen bajo un título con hairline. No
 * hay cards: las secciones son encabezados y renglones. Los avisos son una
 * línea al pie, nunca una tarjeta antes de la cifra, y nada vacío ocupa
 * espacio. En laptop la energía va a la izquierda y el plan a la derecha; en
 * el teléfono es la misma página, estrecha. El canto y las columnas son los
 * de `HoySkeleton`, el esqueleto de `loading.tsx`, y llevan el área segura de
 * los lados como `PageWrapper`.
 *
 * Encima del plan hay como mucho **una** línea, la que el servidor elige entre
 * todos los candidatos del día (`convex/today.ts`). Antes había dos tarjetas
 * que se pintaban a la vez y sin orden: el ritual semanal y la petición de
 * permiso para los avisos. El ritual pasó a ser un candidato de la cola; la
 * puerta al permiso de avisos vive ahora sólo en Ajustes, en su sección de
 * Notificaciones, porque pedir un permiso es una pregunta y la cola tiene
 * candidatos mejores para la única del día.
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
    <div className={HOY_PAGE}>
      <QuickAddFromUrl />
      <InterruptionLine />

      <div className={HOY_COLUMNS}>
        <section aria-label="Energía de hoy" className={HOY_ENERGY_COLUMN}>
          <EnergyTodayCard
            clock={dailyPlan.clock}
            initialCheckins={dailyPlan.checkins}
            projectedCurve={dailyPlan.projectedCurve}
            chronotype={dailyPlan.chronotype}
            predictions={dailyPlan.predictions}
          />
        </section>

        <div className={HOY_PLAN_COLUMN}>
          {/* Los dos van antes del plan y no después: los dos hablan de la
              cifra del día, y detrás de un plan de doce tareas el que dice que
              el día no cabe queda a un scroll de la cifra que lo dice. Ninguno
              pide una decisión, así que no gastan la apertura del día: deciden
              solos si se pintan y se van cuando su motivo desaparece. */}
          <OverBudgetExit />
          <CeilingMutedNotice />

          <TodayPlanCard noProfile={dailyPlan.noProfile} energyItems={energyItems} />

          {topPattern ? (
            <AdvisorCard
              pattern={topPattern}
              actionTaskIds={topPattern.actionTaskIds}
              actionLabel={topPattern.actionLabel}
              bulkAction={topPattern.bulkAction}
            />
          ) : (
            <FocusNowCard currentHour={dailyPlan.clock.hour} energyItems={energyItems} projectedCurve={dailyPlan.projectedCurve} />
          )}

          <ReturnNotice />
          {/* Bajo el plan y no arriba: informa, no pregunta, así que no gasta
              la única apertura del día. */}
          <AgentActivityRow />
          <DashboardBottomRow weeklyTrends={weeklyTrends} insight={learningInsight} />
        </div>
      </div>
    </div>
  );
}
