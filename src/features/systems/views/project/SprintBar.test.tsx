/**
 * Criterio: el botón de crear dice «Nuevo ciclo» y no el nombre de un tipo de
 * TypeScript, y el chip de un ciclo activo enseña su progreso. El literal
 * `SprintTransport` entró aquí en un renombrado mecánico dentro de un PR de 208
 * ficheros que estuvo abierto nueve minutos con los tests en verde: este es el
 * test que faltaba.
 */
import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { makeSprint, makeTask, mid } from "@/app/system-design/mock-data";
import { renderWithProviders } from "@/shared/testing/render";
import { SprintBar } from "./SprintBar";

vi.mock("next/navigation", async () => (await import("@/shared/testing/navigation")).navigationMock());

const CICLO = makeSprint({ name: "Ciclo 3" });
const TAREAS = [
  makeTask({ id: mid("t-1"), sprintId: CICLO.id, status: "done" }),
  makeTask({ id: mid("t-2"), sprintId: CICLO.id, status: "backlog" }),
];

function pintar() {
  renderWithProviders(
    <SprintBar systemId={String(CICLO.systemId)} sprints={[CICLO]} tasks={TAREAS} sprintFilter={null} onSelectFilter={() => {}} />,
  );
}

describe("SprintBar", () => {
  it("el botón de crear se lee en palabras, no en nombres de tipo", () => {
    pintar();

    expect(screen.getByRole("button", { name: "Nuevo ciclo" })).toBeVisible();
    expect(screen.queryByText(/SprintTransport/)).toBeNull();
  });

  it("el chip del ciclo activo enseña cuántas tarjetas lleva hechas", () => {
    pintar();

    const chip = screen.getByRole("button", { name: /Ciclo 3/ });
    expect(chip).toHaveTextContent("1/2");
  });

  it("el filtro de las que no tienen ciclo también habla en palabras", () => {
    pintar();

    expect(screen.getByRole("button", { name: "Sin ciclo" })).toBeVisible();
  });
});
