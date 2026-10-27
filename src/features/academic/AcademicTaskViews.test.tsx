/**
 * Criterio: las cuatro vistas de tareas de un sistema académico son un grupo
 * de botones con nombre: la vista abierta se dice con `aria-pressed`, tocar
 * otra la guarda en la URL, y crear una tarea tiene nombre en el teléfono.
 */
import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MOCK_SYSTEM_ID } from "@/app/system-design/mock-data";
import { renderMobile } from "@/shared/testing/render";
import { setNavigation } from "@/shared/testing/navigation";

vi.mock("next/navigation", async () => (await import("@/shared/testing/navigation")).navigationMock());
// Las vistas son de Tareas: aquí sólo importa cuál se monta. Cada botón lleva
// su palabra corta y la larga (una se oculta por CSS), de ahí el nombre por prefijo.
vi.mock("@/features/tasks/TaskWeekFocusView", () => ({ TaskWeekFocusView: () => <p>vista semana</p> }));
vi.mock("@/features/tasks/TaskCalendarView", () => ({ TaskCalendarView: () => <p>vista calendario</p> }));
vi.mock("@/features/tasks/TaskPlanningView", () => ({ TaskPlanningView: () => <p>vista plan</p> }));
vi.mock("@/features/tasks/TaskArchiveView", () => ({ TaskArchiveView: () => <p>vista archivo</p> }));
vi.mock("@/features/tasks/TaskDetailSheet", () => ({ TaskDetailSheet: () => null }));

const { AcademicTaskViews } = await import("./AcademicTaskViews");

describe("AcademicTaskViews", () => {
  it("dice qué vista está abierta y guarda la elegida en la URL", async () => {
    renderMobile(<AcademicTaskViews systemId={MOCK_SYSTEM_ID} initialTasks={[]} />);

    const grupo = screen.getByRole("group", { name: "Vistas de tareas" });
    expect(grupo).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Semana/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /^Plan/ })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText("vista semana")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /^Plan/ }));
    expect(window.location.search).toBe("?view=planning");
  });

  it("con la vista en la URL monta esa y la marca", () => {
    setNavigation({ search: "?view=archive" });
    renderMobile(<AcademicTaskViews systemId={MOCK_SYSTEM_ID} initialTasks={[]} />);
    expect(screen.getByRole("button", { name: /^Archivo/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("vista archivo")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Nueva tarea en este sistema" })).toBeInTheDocument();
  });
});
