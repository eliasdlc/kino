/**
 * Criterio: la confirmación de lo irreversible pone el foco inicial en
 * Cancelar, nunca en la acción destructiva, para que borrar exija un toque
 * deliberado. En escritorio es un diálogo; en el teléfono es la hoja inferior
 * (ResponsiveDialog), con asa y las dos acciones a 2.85rem, sin botón Cerrar
 * aparte porque Cancelar ya cierra.
 */
import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderMobile, renderWithProviders } from "@/shared/testing/render";
import { ConfirmDialog } from "./confirm-dialog";

const props = {
  open: true,
  title: "Eliminar esta tarea y sus subtareas",
  description: "Se mueve a la papelera.",
  onConfirm: vi.fn(),
  onCancel: vi.fn(),
};

describe("ConfirmDialog", () => {
  it("en escritorio es un diálogo con el foco en Cancelar", () => {
    renderWithProviders(<ConfirmDialog {...props} />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancelar" })).toHaveFocus();
    expect(screen.getByRole("button", { name: "Eliminar" })).not.toHaveFocus();
    expect(screen.queryByRole("button", { name: "Cerrar" })).toBeNull();
  });

  it("en el teléfono es la hoja inferior con asa y las acciones a 2.85rem", () => {
    renderMobile(<ConfirmDialog {...props} />);
    expect(document.querySelector("[data-slot=drawer-content]")).not.toBeNull();
    expect(document.querySelector("[data-slot=drawer-handle]")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByRole("button", { name: "Eliminar" }).className).toContain("h-[2.85rem]");
    expect(screen.getByRole("button", { name: "Cancelar" })).toHaveFocus();
  });
});
