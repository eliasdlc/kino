/**
 * Criterio: en el teléfono la hoja de ResponsiveDialog reserva a la derecha
 * de la cabecera el sitio del botón Cerrar, que es absoluto: un título largo
 * (cuarenta caracteres o más) se parte antes de pasar por debajo del botón,
 * aunque el llamador pase su propia clase a la cabecera.
 */
import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { renderMobile } from "@/shared/testing/render";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "./responsive-dialog";

const TITULO = "Eliminar esta tarea y todas sus subtareas";

describe("ResponsiveDialog en el teléfono", () => {
  it("la cabecera reserva el sitio del botón Cerrar aunque lleve clase propia", () => {
    renderMobile(
      <ResponsiveDialog open>
        <ResponsiveDialogContent>
          <ResponsiveDialogHeader className="gap-1">
            <ResponsiveDialogTitle>{TITULO}</ResponsiveDialogTitle>
          </ResponsiveDialogHeader>
        </ResponsiveDialogContent>
      </ResponsiveDialog>,
    );
    expect(TITULO.length).toBeGreaterThanOrEqual(40);
    const cabecera = screen.getByText(TITULO).closest("[data-slot=drawer-header]");
    expect(cabecera?.className).toContain("pr-12");
    expect(cabecera?.className).toContain("gap-1");
    expect(screen.getByRole("button", { name: "Cerrar" })).toBeInTheDocument();
  });
});
