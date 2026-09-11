/**
 * Cambiar de ciclo conserva el filtro principal y el historial del navegador.
 * Una materia ya asignada toma su período de la relación guardada, aunque
 * la URL señale otro ciclo; el selector escribe sobre la materia raíz.
 */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { renderWithProviders, makeTestConvexClient } from "@/shared/testing/render";
import { setNavigation } from "@/shared/testing/navigation";
import { AcademicWorkspace } from "./AcademicWorkspace";
import { useAcademicScope } from "./academic-scope";
vi.mock("next/navigation", async () => (await import("@/shared/testing/navigation")).navigationMock());
const periods = [{ _id: "current", year: "2026", name: "Segundo", isCurrent: true, isClosed: false }, { _id: "old", year: "2025", name: "Primero", isCurrent: false, isClosed: true }];
const folder = { id: "subject", name: "Cálculo", systemId: "university", academicPeriodId: "old", breadcrumb: [] };
function Scope() { const scope = useAcademicScope("university"); return <p>{scope?.folderId ?? scope?.academicPeriodId ?? "unassigned"}</p>; }
function client() { return makeTestConvexClient([{ name: "academicPeriods:list", value: periods }, { name: "folders:bySystem", value: [folder] }, { name: "folders:detail", value: folder }]); }
describe("AcademicWorkspace", () => {
  it("abre el actual y permite volver a un ciclo cerrado sin perder el tab", () => {
    window.history.replaceState(null, "", "/systems/university?tab=docs");
    setNavigation({ search: "tab=docs" });
    const { rerender } = renderWithProviders(<AcademicWorkspace systemId="university"><Scope /></AcademicWorkspace>, { convex: client() });
    expect(screen.getByText("current")).toBeVisible();
    fireEvent.click(screen.getByText("2025", { selector: "summary" }));
    fireEvent.click(screen.getByText("Primero"));
    fireEvent.click(screen.getAllByRole("button", { name: "Ver ciclo" })[1]);
    expect(window.location.search).toBe("?tab=docs&cycle=old");
    setNavigation({ search: window.location.search });
    rerender(<AcademicWorkspace systemId="university"><Scope /></AcademicWorkspace>);
    expect(screen.getByText("old")).toBeVisible();
  });
  it("muestra el ciclo guardado de la materia y escribe su nueva asignación", async () => {
    setNavigation({ search: "cycle=current" });
    const convex = client();
    renderWithProviders(<AcademicWorkspace systemId="university" folderId="subject"><Scope /></AcademicWorkspace>, { convex });
    expect(screen.getByLabelText("Año y ciclo")).toHaveValue("old");
    fireEvent.change(screen.getByLabelText("Año y ciclo"), { target: { value: "current" } });
    expect(convex.calls).toContainEqual({ kind: "mutation", name: "academicPeriods:assignSubject", args: { folderId: "subject", periodId: "current" } });
  });
});
