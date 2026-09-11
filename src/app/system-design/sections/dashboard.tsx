"use client";

import { api } from "@convex/_generated/api";
import { Section, SubSection, Specimen, SpecimenGrid, Seeded, seedQuery } from "../helpers";
import {
  makeTask,
  makeCheckin,
  makeEnergyPlanItem,
  mockWeeklyTrend,
  mockLearningInsight,
  mockAdvisorPattern,
  MOCK_CURVE, mid } from "../mock-data";
import { EnergyTodayCard } from "@/features/dashboard/EnergyTodayCard";
import { EnergyChart } from "@/features/dashboard/EnergyChart";
import { EnergyCheckinForm } from "@/features/dashboard/EnergyCheckinForm";
import { FocusNowCard } from "@/features/dashboard/FocusNowCard";
import { PlanTaskRow } from "@/features/dashboard/PlanTaskRow";
import { WeeklyTrendsCard } from "@/features/dashboard/WeeklyTrendsCard";
import { LearningInsightCard } from "@/features/dashboard/LearningInsightCard";
import { AdvisorCard } from "@/features/dashboard/AdvisorCard";
import { QuickAccessCard } from "@/features/dashboard/QuickAccessCard";
import { OverBudgetExit } from "@/features/energy/OverBudgetExit";
import { CeilingMutedNotice } from "@/features/energy/CeilingMutedNotice";
import { ReturnNotice } from "@/features/today/ReturnNotice";
import { ClosingSignature } from "@/features/tasks/TaskDetailFields";
import type { TaskTransport } from "@/features/tasks/tasks.types";

const noop = () => {};

/** El día en sobregiro, con las tres que menos urgencia tienen. */
/** El instrumento descalibrado: catorce mediciones y su error. */
const TECHO_APAGADO = {
  mutedAt: "2026-09-08T00:00:00.000Z",
  errorMedio: 31,
  dias: 14,
  umbral: 25,
  predicciones: Array.from({ length: 14 }, (_, i) => {
    const dia = new Date(Date.UTC(2026, 7, 26 + i));
    const falla = i % 3 !== 0;
    return {
      date: dia.toISOString().slice(0, 10),
      slot: "morning",
      predicted: 50,
      reported: falla ? 16 : 42,
      error: falla ? 34 : 8,
    };
  }),
};

const SOBREGIRO = {
  committed: 62,
  limit: 50,
  overBy: 12,
  mover: [
    { id: "t-1", title: "Leer el syllabus de Bases de Datos", points: 3 },
    { id: "t-2", title: "Outline: en qué termina la historia", points: 3 },
    { id: "t-3", title: "Cambiar el filtro del agua", points: 1 },
  ],
};

/** La ausencia que el estado de regreso mide, con y sin datos de energía. */
const regreso = (conEnergia: boolean) => [
  seedQuery(api.today.returnNotice, {
    dias: 14,
    ultimaSesion: new Date(Date.now() - 14 * 86_400_000).toISOString(),
    vencidas: 9,
    repetidas: 2,
    conEnergia,
  }),
];

/** Una tarea cerrada por cada vía, más una cerrada antes de que la firma existiera. */
const cerrada = (completedVia: string | null) =>
  ({ id: mid("t1"), title: "Entregar el informe", completedAt: new Date().toISOString(), completedVia }) as unknown as TaskTransport;

const conTiempo = (totalMinutes: number) => [seedQuery(api.tasks.timeLogSummary, { totalMinutes, sessionCount: 3 })];

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
      description="Las piezas de Hoy con datos de muestra: la cota, el plan de dos niveles, el enfoque y la fila de lo que Kino sabe. En laptop la energía va a la izquierda y el plan a la derecha; en el teléfono es la misma pantalla, estrecha."
    >
      <SubSection
        title="EnergyTodayCard"
        description="El hero de energía: número con halo, curva proyectada vs. check-ins reales, selector de franja y formulario. Interactivo (el submit falla sin backend)."
      >
        <div className="max-w-xl">
          <EnergyTodayCard
            clock={{ hour: 15, date: "2026-09-11", timezone: "America/Santo_Domingo" }}
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
            currentHour={15}
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
            onComplete={noop}
            onMoveToTomorrow={noop}
            onRemove={noop}
            onStartTimer={noop}
          />
          <PlanTaskRow
            task={makeTask({ id: mid("p2"), title: "Revisar correos de la beca", estimatedTime: "00:30:00" })}
            onComplete={noop}
            onMoveToTomorrow={noop}
            onRemove={noop}
            onStartTimer={noop}
          />
          <PlanTaskRow
            task={makeTask({ id: mid("p3"), title: "Salir a caminar", priority: "low", energyLevel: "low" })}
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
        title="El día que no cabe"
        description="La salida del sobregiro: la cifra delante, el día como sujeto, y las tres del plan que menos urgencia tienen ya elegidas. En ámbar, porque el rojo queda para lo irreversible y pasarse del techo no lo es. Sin botón de dejarlo así: el bloque se va cuando el día vuelve a caber, no cuando alguien lo silencia."
      >
        <SpecimenGrid cols={2}>
          <Specimen label="OverBudgetExit" hint="62 de 50 puntos" className="items-stretch">
            <Seeded stubs={[seedQuery(api.energy.overBudgetExit, SOBREGIRO)]}>
              <div className="w-full">
                <OverBudgetExit />
              </div>
            </Seeded>
          </Specimen>
          <Specimen
            label="CeilingMutedNotice"
            hint="el techo apagado, con sus catorce mediciones"
            className="items-stretch"
          >
            <Seeded stubs={[seedQuery(api.energy.ceilingHonesty, TECHO_APAGADO)]}>
              <div className="w-full">
                <CeilingMutedNotice />
              </div>
            </Seeded>
          </Specimen>
          <Specimen label="AdvisorCard" hint="los dos patrones que quedan" className="items-stretch">
            <div className="w-full">
              <AdvisorCard
                pattern={mockAdvisorPattern()}
                actionTaskIds={["a"]}
                actionLabel="Poner la más pequeña en hoy"
                bulkAction="move-today"
              />
            </div>
          </Specimen>
        </SpecimenGrid>
      </SubSection>

      <SubSection
        title="La firma del cierre"
        description="En el detalle de una tarea cerrada: quién la cerró, por qué vía y cuánto trabajo observado tiene, que sale de los time logs y nunca de la estimación. Los tres estados van al mismo tamaño de letra a propósito: lo que no se sabe pesa lo mismo que lo que se sabe."
      >
        <SpecimenGrid>
          <Specimen label="Desde el navegador" hint="completedVia: session">
            <Seeded stubs={conTiempo(95)}>
              <ClosingSignature task={cerrada("session")} />
            </Seeded>
          </Specimen>
          <Specimen label="Cerrada en GitHub" hint="completedVia: sync, sin persona">
            <Seeded stubs={conTiempo(0)}>
              <ClosingSignature task={cerrada("sync")} />
            </Seeded>
          </Specimen>
          <Specimen label="Sin firma" hint="anterior al registro de autoría">
            <Seeded stubs={conTiempo(0)}>
              <ClosingSignature task={cerrada(null)} />
            </Seeded>
          </Specimen>
        </SpecimenGrid>
      </SubSection>

      <SubSection
        title="El estado de regreso"
        description="Bajo el plan al volver después de más de siete días. No pide ninguna decisión, así que no gasta la única interrupción del día: si hoy además hay línea arriba, salen las dos."
      >
        <SpecimenGrid>
          <Specimen label="Con datos de energía" hint="conEnergia: true">
            <Seeded stubs={regreso(true)}>
              <ReturnNotice />
            </Seeded>
          </Specimen>
          <Specimen label="Sin datos del periodo" hint="lo dice en la misma frase y al mismo tamaño">
            <Seeded stubs={regreso(false)}>
              <ReturnNotice />
            </Seeded>
          </Specimen>
        </SpecimenGrid>
      </SubSection>

      <SubSection title="QuickAccessCard" description="Acceso rápido a sistemas con punto de color.">
        <div className="max-w-md">
          <QuickAccessCard
            systems={[
              { id: mid("s1"), name: "Universidad", color: "blue", icon: "book" },
              { id: mid("s2"), name: "Side project", color: "purple", icon: "rocket" },
              { id: mid("s3"), name: "Salud", color: "green", icon: "heart" },
            ]}
          />
        </div>
      </SubSection>

    </Section>
  );
}
