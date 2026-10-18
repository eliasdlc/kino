/**
 * Criterio: el archivo de un proyecto es un índice de ciclos cerrados, no una
 * pila de cajas. Cada ciclo es una fila que se pliega (el botón dice si está
 * abierto) y su borrado nombra qué ciclo borra. Sin ciclos cerrados, el estado
 * vacío habla de ciclos, no de «sprints».
 */
import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { makeSprint, makeTask, mid, MOCK_SYSTEM_ID } from "@/app/system-design/mock-data";
import { renderWithProviders } from "@/shared/testing/render";
import { ProjectArchive } from "./ProjectArchive";

vi.mock("next/navigation", async () => (await import("@/shared/testing/navigation")).navigationMock());

const CERRADO = makeSprint({ id: mid("ciclo-cerrado"), name: "Ciclo 2", status: "completed", completedAt: Date.now() } as never);
const TAREA = makeTask({ id: mid("tarea-archivada"), title: "Cerrar la landing", sprintId: CERRADO.id, status: "done" });

describe("ProjectArchive", () => {
  it("un ciclo cerrado se pliega y se despliega desde su fila", async () => {
    renderWithProviders(
      <ProjectArchive systemId={MOCK_SYSTEM_ID} initialData={[TAREA]} sprints={[CERRADO]} />,
    );

    const fila = screen.getByRole("button", { name: /^Ciclo 2/ });
    expect(fila).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Cerrar la landing")).toBeNull();

    await userEvent.click(fila);

    expect(fila).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Cerrar la landing")).toBeVisible();
    expect(screen.getByRole("button", { name: "Eliminar el ciclo Ciclo 2" })).toBeVisible();
  });

  it("sin ciclos cerrados dice ciclos, no sprints", () => {
    renderWithProviders(<ProjectArchive systemId={MOCK_SYSTEM_ID} initialData={[]} sprints={[]} />);

    expect(screen.getByRole("heading", { name: "Aún no hay ciclos cerrados" })).toBeVisible();
    expect(screen.queryByText(/sprint/i)).toBeNull();
  });
});
