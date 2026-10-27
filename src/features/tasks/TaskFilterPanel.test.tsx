/**
 * Criterio: la hoja de filtros ofrece cada grupo con su nombre (Estado,
 * Prioridad, Energía, Tipo, Fecha, Ordenar por, Agrupar por) y el grupo Tipo
 * lista los tipos de verdad (Tarea, Idea, Evento, Recordatorio, Épica), no el
 * `todo` ni el `project` de antes. Tocar una ficha avisa del filtro nuevo sin
 * perder los que ya estaban.
 */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen, within } from "@testing-library/react";
import { DEFAULT_FILTERS, type TaskFilters } from "@/lib/taskFilters";
import { renderWithProviders } from "@/shared/testing/render";
import { TaskFilterPanel } from "./TaskFilterPanel";

function pintar(filters: TaskFilters = DEFAULT_FILTERS) {
  const onChange = vi.fn<(next: TaskFilters) => void>();
  renderWithProviders(<TaskFilterPanel filters={filters} systems={[]} onChange={onChange} />);
  return { onChange };
}

describe("TaskFilterPanel", () => {
  it("cada grupo es un role group con el nombre de su rótulo", () => {
    pintar();

    for (const nombre of ["Estado", "Prioridad", "Energía", "Tipo", "Fecha", "Ordenar por", "Agrupar por"]) {
      expect(screen.getByRole("group", { name: nombre })).toBeInTheDocument();
    }
  });

  it("el grupo Tipo ofrece exactamente Tarea, Idea, Evento, Recordatorio y Épica", () => {
    pintar();

    const fichas = within(screen.getByRole("group", { name: "Tipo" })).getAllByRole("button");

    expect(fichas.map((f) => f.textContent)).toEqual(["Tarea", "Idea", "Evento", "Recordatorio", "Épica"]);
  });

  it("tocar Épica filtra por el tipo epic", () => {
    const { onChange } = pintar();

    fireEvent.click(within(screen.getByRole("group", { name: "Tipo" })).getByRole("button", { name: "Épica" }));

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ type: ["epic"] }));
  });

  it("la ficha elegida se marca con aria-pressed y tocarla otra vez la quita", () => {
    const { onChange } = pintar({ ...DEFAULT_FILTERS, type: ["epic", "idea"] });
    const tipo = within(screen.getByRole("group", { name: "Tipo" }));

    expect(tipo.getByRole("button", { name: "Épica" })).toHaveAttribute("aria-pressed", "true");
    expect(tipo.getByRole("button", { name: "Tarea" })).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(tipo.getByRole("button", { name: "Épica" }));

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ type: ["idea"] }));
  });
});
