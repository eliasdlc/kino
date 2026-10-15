/**
 * Criterio: la etiqueta enseña la prioridad que cuenta, y cuando la fecha la
 * subió por encima de la elegida lo dice (flecha, título y texto para lector
 * de pantalla). Sin subida, no añade nada: «Alta» a secas.
 */
import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/shared/testing/render";
import { PriorityTag } from "./TaskTags";

describe("PriorityTag", () => {
  it("subida por la fecha: pinta la que cuenta y dice cuál se eligió", () => {
    renderWithProviders(<PriorityTag priority="critical" chosen="low" />);
    const tag = screen.getByText("Crítica").closest("span")!;
    expect(tag).toHaveAttribute("title", "Subió por la fecha. La elegiste baja.");
    expect(screen.getByText(/subió por la fecha; la elegiste baja/)).toBeInTheDocument();
  });

  it("sin subida no añade nada", () => {
    renderWithProviders(<PriorityTag priority="high" chosen="high" />);
    expect(screen.getByText("Alta").closest("span")).not.toHaveAttribute("title");
    expect(screen.queryByText(/subió por la fecha/)).not.toBeInTheDocument();
  });
});
