/**
 * Criterio: el badge es un par tintado (el rol al 15 por ciento de fondo y el
 * texto de tinte del rol, que en claro lleva tinta mezclada para dar 4,5 o
 * más), nunca un bloque lleno, y trae las variantes de estado que el producto
 * necesita con su palabra: vencida y hecha. La barra de progreso es superficie
 * con el acento encima. Ninguna lleva px.
 */
import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/shared/testing/render";
import { Badge } from "./badge";
import { Progress } from "./progress";

describe("el badge", () => {
  it("es un par tintado en todas sus variantes", () => {
    renderWithProviders(
      <>
        <Badge>Semana</Badge>
        <Badge variant="warn">vencida</Badge>
        <Badge variant="ok">hecha</Badge>
      </>,
    );
    expect(screen.getByText("Semana").className).toContain("bg-primary/15");
    expect(screen.getByText("Semana").className).toContain("text-(--ac-text)");
    expect(screen.getByText("Semana").className).not.toMatch(/\bbg-primary\b(?!\/)/);
    expect(screen.getByText("vencida").className).toContain("text-(--warn-text)");
    expect(screen.getByText("hecha").className).toContain("bg-task-done/15");
    expect(screen.getByText("hecha").className).toContain("text-(--ok-text)");
    expect(screen.getByText("Semana").className).not.toMatch(/\[\d+px\]/);
  });
});

describe("la barra de progreso", () => {
  it("es superficie con el acento encima", () => {
    renderWithProviders(<Progress value={34} aria-label="Energía comprometida" />);
    const barra = screen.getByRole("progressbar", { name: "Energía comprometida" });
    expect(barra.className).toContain("bg-secondary");
    expect(barra.querySelector("[data-slot=progress-indicator]")?.className).toContain("bg-primary");
  });
});
