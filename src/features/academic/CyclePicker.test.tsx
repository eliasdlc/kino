/**
 * Criterio: el ciclo se cambia desde la cabecera sin pedirle la página al
 * servidor y sin perder el resto de la URL, y el control enseña siempre en qué
 * ciclo estás. Es el reemplazo del árbol de años y ciclos que ocupaba la
 * primera pantalla.
 */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { renderWithProviders, makeTestConvexClient } from "@/shared/testing/render";
import { setNavigation, testRouter } from "@/shared/testing/navigation";
import { CyclePicker } from "./CyclePicker";
import type { AcademicPeriod } from "./academic.hooks";

vi.mock("next/navigation", async () => (await import("@/shared/testing/navigation")).navigationMock());

/** Los ids de Convex son tipos marcados; en un test se fabrican. */
function period(id: string, year: string, name: string, flags: { isCurrent?: boolean; isClosed?: boolean } = {}): AcademicPeriod {
  return {
    _id: id as AcademicPeriod["_id"],
    _creationTime: 0,
    createdAt: 0,
    updatedAt: 0,
    userId: "user" as AcademicPeriod["userId"],
    systemId: "university" as AcademicPeriod["systemId"],
    year,
    name,
    isCurrent: flags.isCurrent ?? false,
    isClosed: flags.isClosed ?? false,
  };
}

const periods = [
  period("current", "2026-2027", "Septiembre de 2026", { isCurrent: true }),
  period("old", "2025-2026", "Enero de 2026", { isClosed: true }),
];

const system = {
  id: "university",
  name: "Universidad",
  metadata: null,
} as unknown as Parameters<typeof CyclePicker>[0]["system"];

describe("CyclePicker", () => {
  it("enseña el ciclo actual y cambia a otro conservando el resto de la URL", () => {
    window.history.replaceState(null, "", "/systems/university?tab=docs");
    setNavigation({ search: "tab=docs" });
    renderWithProviders(<CyclePicker system={system} initialPeriods={periods} />, {
      convex: makeTestConvexClient([{ name: "academicPeriods:list", value: periods }]),
    });

    expect(screen.getByRole("button", { name: "Ciclo: Septiembre de 2026" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Ciclo: Septiembre de 2026" }));
    fireEvent.click(screen.getByText("Enero de 2026"));

    expect(window.location.search).toBe("?tab=docs&cycle=old");
    expect(testRouter.push).not.toHaveBeenCalled();
  });

  it("ofrece ver lo que no tiene ciclo", () => {
    window.history.replaceState(null, "", "/systems/university");
    setNavigation({ search: "" });
    renderWithProviders(<CyclePicker system={system} initialPeriods={periods} />, {
      convex: makeTestConvexClient([{ name: "academicPeriods:list", value: periods }]),
    });

    fireEvent.click(screen.getByRole("button", { name: "Ciclo: Septiembre de 2026" }));
    fireEvent.click(screen.getByText("Sin ciclo"));

    expect(window.location.search).toBe("?cycle=unassigned");
  });
});
