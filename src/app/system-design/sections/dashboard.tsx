"use client";

import { Section, SubSection, Specimen, SpecimenGrid } from "../helpers";
import {
  makeTask,
  makeCheckin,
  makeEnergyPlanItem,
  mockWeeklyTrend,
  mockLearningInsight,
  mockAdvisorPattern,
  MOCK_CURVE,
} from "../mock-data";
import { EnergyTodayCard } from "@/features/dashboard/EnergyTodayCard";
import { EnergyChart } from "@/features/dashboard/EnergyChart";
import { EnergyCheckinForm } from "@/features/dashboard/EnergyCheckinForm";
import { FocusNowCard } from "@/features/dashboard/FocusNowCard";
import { PlanTaskRow } from "@/features/dashboard/PlanTaskRow";
import { WeeklyTrendsCard } from "@/features/dashboard/WeeklyTrendsCard";
import { LearningInsightCard } from "@/features/dashboard/LearningInsightCard";
import { AdvisorCard } from "@/features/dashboard/AdvisorCard";
import { QuickAccessCard } from "@/features/dashboard/QuickAccessCard";
import { EnergyAdvisorBanner } from "@/components/EnergyAdvisorBanner";
import { Moon } from "lucide-react";

const noop = () => {};

const chartData = MOCK_CURVE.map((predicted, hour) => ({
  hour,
  predicted,
  actual: hour === 9 ? 72 : hour === 15 ? 58 : null,
}));

export function DashboardSection() {
  return (
    <Section
      id="dashboard"
      number="10"
      title="Dashboard"
      description="Las cards del dashboard con datos de muestra. La grid real usa .dashboard-grid (áreas plan/side/bottom con altura fija, ver esquema al final)."
    >
      <SubSection
        title="EnergyTodayCard"
        description="El hero de energía: número con halo, curva proyectada vs. check-ins reales, selector de franja y formulario. Interactivo (el submit falla sin backend)."
      >
        <div className="max-w-xl">
          <EnergyTodayCard
            initialCheckins={[makeCheckin()]}
            projectedCurve={MOCK_CURVE}
            chronotype="morning"
          />
        </div>
      </SubSection>

      <SubSection
        title="EnergyChart"
        description="La curva 24h aislada (recharts): línea predicha + puntos de check-in reales + banda de pico."
      >
        <div className="max-w-xl rounded-lg border border-border bg-card p-4">
          <EnergyChart
            data={chartData}
            peak={{ start: 9, end: 12 }}
            currentHour={new Date().getHours()}
            animate={false}
          />
        </div>
      </SubSection>

      <SubSection title="EnergyCheckinForm" description="Formulario de check-in: slider de nivel, franja y calidad de sueño.">
        <div className="max-w-md rounded-lg border border-border bg-card p-4">
          <EnergyCheckinForm
            defaultLevel={65}
            initialSlot="morning"
            isPending={false}
            onSubmit={noop}
            onCancel={noop}
          />
        </div>
      </SubSection>

      <SubSection
        title="FocusNowCard"
        description="Recomienda sesiones de foco según energía actual. Sin plan de hoy (no hay fetch aquí) muestra el estado sin tarea."
      >
        <div className="max-w-md">
          <FocusNowCard
            energyItems={[makeEnergyPlanItem(makeTask({ title: "Repasar cálculo" }))]}
            projectedCurve={MOCK_CURVE}
          />
        </div>
      </SubSection>

      <SubSection
        title="PlanTaskRow"
        description="La fila del plan de hoy: la primera va destacada; hover muestra acciones (timer, mañana, quitar)."
      >
        <div className="max-w-xl divide-y divide-border rounded-lg border border-border bg-card">
          <PlanTaskRow
            task={makeTask({ title: "Terminar informe de laboratorio", priority: "critical", estimatedTime: "01:30:00" })}
            isFirst
            onComplete={noop}
            onMoveToTomorrow={noop}
            onRemove={noop}
            onStartTimer={noop}
          />
          <PlanTaskRow
            task={makeTask({ id: "p2", title: "Revisar correos de la beca", estimatedTime: "00:30:00" })}
            isFirst={false}
            onComplete={noop}
            onMoveToTomorrow={noop}
            onRemove={noop}
            onStartTimer={noop}
          />
          <PlanTaskRow
            task={makeTask({ id: "p3", title: "Salir a caminar", priority: "low", energyLevel: "low" })}
            isFirst={false}
            onComplete={noop}
            onMoveToTomorrow={noop}
            onRemove={noop}
            onStartTimer={noop}
          />
        </div>
      </SubSection>

      <SubSection title="Fila inferior (WeeklyTrends + LearningInsight)">
        <SpecimenGrid cols={2}>
          <Specimen label="WeeklyTrendsCard" hint="tasa de completado + energía de 7 días" className="items-stretch">
            <div className="w-full rounded-lg border border-border bg-card">
              <WeeklyTrendsCard trends={mockWeeklyTrend()} />
            </div>
          </Specimen>
          <Specimen label="LearningInsightCard" hint="«Kino te conoce»: pico, precisión, personalización" className="items-stretch">
            <div className="w-full rounded-lg border border-border bg-card">
              <LearningInsightCard insight={mockLearningInsight()} />
            </div>
          </Specimen>
        </SpecimenGrid>
      </SubSection>

      <SubSection
        title="AdvisorCard y banner"
        description="El consejero de patrones (overload/abandonment/disorganization/underuse) y el banner compacto de aviso."
      >
        <SpecimenGrid cols={2}>
          <Specimen label="AdvisorCard" hint="pattern overload, severidad 2" className="items-stretch">
            <div className="w-full">
              <AdvisorCard
                pattern={mockAdvisorPattern()}
                actionTaskIds={["a", "b", "c"]}
                actionLabel="Mover 3 a mañana"
                bulkAction="move-tomorrow"
              />
            </div>
          </Specimen>
          <Specimen label="EnergyAdvisorBanner" hint="mensaje + acción opcional" className="items-stretch">
            <div className="w-full space-y-2">
              <EnergyAdvisorBanner message="Tu energía cae después de las 16h: agenda lo ligero ahí." />
              <EnergyAdvisorBanner
                icon={Moon}
                message="Dormiste mal. Kino redujo tu plan de hoy."
                action={{ label: "Ver plan", onClick: noop }}
              />
            </div>
          </Specimen>
        </SpecimenGrid>
      </SubSection>

      <SubSection title="QuickAccessCard" description="Acceso rápido a sistemas con punto de color.">
        <div className="max-w-md">
          <QuickAccessCard
            systems={[
              { id: "s1", name: "Universidad", color: "blue", icon: "book" },
              { id: "s2", name: "Side project", color: "purple", icon: "rocket" },
              { id: "s3", name: "Salud", color: "green", icon: "heart" },
            ]}
          />
        </div>
      </SubSection>

      <SubSection
        title="Esquema .dashboard-grid"
        description="La grid del dashboard desktop: plan (1.6fr) + side (1fr) arriba, fila bottom de altura clamp(168px, 26vh, 220px). En móvil colapsa a una columna."
      >
        <div className="dashboard-grid h-80 rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
          <div className="dashboard-plan flex items-center justify-center rounded-md border border-border bg-muted/40">
            plan — TodayPlanCard
          </div>
          <div className="dashboard-side flex items-center justify-center rounded-md border border-border bg-muted/40">
            side — EnergyTodayCard
          </div>
          <div className="dashboard-bottom flex items-center justify-center rounded-md border border-border bg-muted/40">
            bottom — WeeklyTrends · LearningInsight · QuickAccess
          </div>
        </div>
      </SubSection>
    </Section>
  );
}
