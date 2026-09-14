/**
 * Criterio: el proveedor de scope decide qué ciclo miran las listas, y nunca
 * esconde lo que el servidor ya pintó. Manda la URL; sin `cycle`, el ciclo
 * actual; dentro de una clase, la clase. Los hijos se ven desde el primer
 * render, incluso antes de que la suscripción de ciclos responda.
 */
import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders, makeTestConvexClient } from "@/shared/testing/render";
import { setNavigation } from "@/shared/testing/navigation";
import { AcademicWorkspace } from "./AcademicWorkspace";
import { useAcademicScope } from "./academic-scope";

vi.mock("next/navigation", async () => (await import("@/shared/testing/navigation")).navigationMock());

const periods = [
  { _id: "current", year: "2026-2027", name: "Septiembre de 2026", isCurrent: true, isClosed: false },
  { _id: "old", year: "2025-2026", name: "Enero de 2026", isCurrent: false, isClosed: true },
];

function Scope() {
  const scope = useAcademicScope("university");
  return <p>scope: {scope?.folderId ?? scope?.academicPeriodId ?? "unassigned"}</p>;
}

function client() {
  return makeTestConvexClient([{ name: "academicPeriods:list", value: periods }]);
}

describe("AcademicWorkspace", () => {
  it("cae en el ciclo actual cuando la URL no pide ninguno", () => {
    setNavigation({ search: "tab=docs" });
    renderWithProviders(
      <AcademicWorkspace systemId="university">
        <Scope />
      </AcademicWorkspace>,
      { convex: client() },
    );
    expect(screen.getByText("scope: current")).toBeVisible();
  });

  it("obedece el ciclo de la URL, aunque esté cerrado", () => {
    setNavigation({ search: "cycle=old" });
    renderWithProviders(
      <AcademicWorkspace systemId="university">
        <Scope />
      </AcademicWorkspace>,
      { convex: client() },
    );
    expect(screen.getByText("scope: old")).toBeVisible();
  });

  it("dentro de una clase el scope es la clase", () => {
    setNavigation({ search: "cycle=current" });
    renderWithProviders(
      <AcademicWorkspace systemId="university" folderId="subject">
        <Scope />
      </AcademicWorkspace>,
      { convex: client() },
    );
    expect(screen.getByText("scope: subject")).toBeVisible();
  });

  it("pinta a sus hijos aunque la lista de ciclos no haya respondido", () => {
    setNavigation({ search: "" });
    renderWithProviders(
      <AcademicWorkspace systemId="university">
        <p>Entrega de cálculo</p>
      </AcademicWorkspace>,
      { convex: makeTestConvexClient() },
    );
    expect(screen.getByText("Entrega de cálculo")).toBeVisible();
  });
});
