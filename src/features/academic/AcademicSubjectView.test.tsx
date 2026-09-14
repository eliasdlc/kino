/**
 * Criterio: abrir una clase enseña lo que contiene, no un índice de pestañas.
 * Los apuntes van arriba y las entregas debajo, en la misma página, y el ciclo
 * es una etiqueta que se toca para mover la clase, no un formulario.
 */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { makeTestConvexClient, renderMobile } from "@/shared/testing/render";
import { setNavigation } from "@/shared/testing/navigation";
import { AcademicSubjectView } from "./AcademicSubjectView";
import type { AcademicPeriod } from "./academic.hooks";
import type { SystemTransport } from "@/features/systems/systems.types";

vi.mock("next/navigation", async () => (await import("@/shared/testing/navigation")).navigationMock());

const periods = [
  {
    _id: "current",
    _creationTime: 0,
    createdAt: 0,
    updatedAt: 0,
    userId: "user",
    systemId: "university",
    year: "2026-2027",
    name: "Septiembre de 2026",
    isCurrent: true,
    isClosed: false,
  },
] as unknown as AcademicPeriod[];

const system = { id: "university", name: "Universidad", templateType: "academic" } as unknown as SystemTransport;

const folder = {
  id: "calculo",
  name: "Cálculo III",
  metadata: { professor: "Prof. Rodríguez", schedule: "Lun y Mie 9:00" },
  academicPeriodId: "current",
};

function renderSubject() {
  setNavigation({ search: "" });
  return renderMobile(
    <AcademicSubjectView
      system={system}
      folder={folder}
      subject={folder}
      periods={periods}
      initialTasks={[]}
      documents={<p>Límites y continuidad</p>}
    />,
    { convex: makeTestConvexClient([{ name: "tasks:byFolder", value: [] }]) },
  );
}

describe("AcademicSubjectView", () => {
  it("enseña los apuntes y las entregas en la misma página", () => {
    renderSubject();
    expect(screen.getByRole("heading", { name: "Cálculo III" })).toBeVisible();
    expect(screen.getByText("Apuntes")).toBeVisible();
    expect(screen.getByText("Límites y continuidad")).toBeVisible();
    expect(screen.getByText("Entregas y exámenes")).toBeVisible();
  });

  it("no separa tareas y apuntes en pestañas", () => {
    renderSubject();
    const tabs = screen.getAllByRole("tab").map((tab) => tab.textContent);
    expect(tabs.join(" ")).not.toContain("Apuntes");
  });

  it("enseña el profesor y el horario de la clase", () => {
    renderSubject();
    expect(screen.getByText("Prof. Rodríguez")).toBeVisible();
    expect(screen.getByText("Lun y Mie 9:00")).toBeVisible();
  });

  it("el ciclo es una etiqueta que abre mover la clase", () => {
    renderSubject();
    const chip = screen.getByRole("button", { name: /Ciclo: Septiembre de 2026/ });
    expect(chip).toBeVisible();
    fireEvent.click(chip);
    expect(screen.getByText("Mover Cálculo III a un ciclo")).toBeVisible();
  });
});
