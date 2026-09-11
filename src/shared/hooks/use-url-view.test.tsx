/**
 * La navegación conserva la pestaña y la semana al salir de una materia.
 * Los parámetros inválidos no dejan una pestaña vacía ni una fecha inválida.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { renderWithProviders } from "@/shared/testing/render";
import { setNavigation } from "@/shared/testing/navigation";
import { usePlanningWeek, useUrlView } from "./use-url-view";

vi.mock("next/navigation", async () => (await import("@/shared/testing/navigation")).navigationMock());

function View() {
  const [tab, setTab] = useUrlView(["action", "planning"], "action");
  const [week, setWeek] = usePlanningWeek();
  return <>
    <p>{tab} · {week}</p>
    <button onClick={() => setTab("planning")}>Planificar</button>
    <button onClick={() => setWeek((previous) => previous + 1)}>Semana siguiente</button>
  </>;
}

beforeEach(() => {
  window.history.replaceState(null, "", "/systems/academic?tab=tasks");
});

describe("contexto de navegación", () => {
  it("guarda la pestaña y la semana en entradas de historial sin perder el tab principal", () => {
    setNavigation({ pathname: "/systems/academic", search: "tab=tasks" });
    const { rerender } = renderWithProviders(<View />);
    fireEvent.click(screen.getByRole("button", { name: "Planificar" }));
    expect(window.location.search).toBe("?tab=tasks&view=planning");
    setNavigation({ search: window.location.search });
    rerender(<View />);
    fireEvent.click(screen.getByRole("button", { name: "Semana siguiente" }));
    expect(window.location.search).toBe("?tab=tasks&view=planning&week=1");

    setNavigation({ search: "tab=tasks&view=planning&week=1" });
    rerender(<View />);
    expect(screen.getByText("planning · 1")).toBeVisible();
    setNavigation({ search: "tab=tasks&view=invalid&week=Infinity" });
    rerender(<View />);
    expect(screen.getByText("action · 0")).toBeVisible();
  });

});
