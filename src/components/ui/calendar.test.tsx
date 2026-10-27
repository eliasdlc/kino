/**
 * Criterio: el día del calendario es un botón de la casa: lleva el foco único
 * y, cuando react-day-picker lo enfoca con las flechas, el anillo del acento,
 * aunque el foco llegue por código. Las celdas miden el táctil en el teléfono.
 */
import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/shared/testing/render";
import { Calendar } from "./calendar";

describe("Calendar", () => {
  it("el día lleva el foco único y el anillo del día enfocado", () => {
    renderWithProviders(<Calendar mode="single" defaultMonth={new Date(2026, 9, 1)} />);
    const dia = screen.getAllByRole("gridcell")[10].querySelector("button");
    expect(dia?.className).toContain("focus-ring");
    expect(dia?.className).toContain("group-data-[focused=true]/day:focus:outline-ring");
    const raiz = document.querySelector("[data-slot=calendar]");
    expect(raiz?.className).toContain("[--cell-size:2.85rem]");
  });
});
