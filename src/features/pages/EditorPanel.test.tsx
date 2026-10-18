/**
 * Criterio: en el teléfono el panel del editor se queda con lo que escribir
 * necesita. Los atajos de formato son de teclado físico y sólo se enseñan en
 * escritorio; en un dedo el formato vive en la barra del pulgar.
 */
import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderMobile, renderWithProviders } from "@/shared/testing/render";
import EditorPanel from "./EditorPanel";
import type { PageDetailTransport } from "./pages.types";

vi.mock("next/navigation", async () => (await import("@/shared/testing/navigation")).navigationMock());

const pagina = {
  id: "p1",
  systemId: "s1",
  title: "Apuntes",
  content: "<p>Hola</p>",
  completedAt: null,
} as unknown as PageDetailTransport;

const props = {
  open: true,
  onOpenChange: () => {},
  page: pagina,
  systemId: "s1",
  rootPageId: "p1",
  initialSubPages: [],
  outline: [],
  onJump: () => {},
  writer: false,
  obra: null,
  obraMetadata: null,
  medium: null,
};

describe("EditorPanel", () => {
  it("en escritorio enseña los atajos de formato", async () => {
    renderWithProviders(<EditorPanel {...props} />);
    expect(await screen.findByRole("heading", { name: "Atajos de formato" })).toBeVisible();
  });

  it("en el teléfono los deja fuera y conserva el resto del panel", async () => {
    renderMobile(<EditorPanel {...props} />);
    expect(await screen.findByRole("heading", { name: "Exportar" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Atajos de formato" })).not.toBeInTheDocument();
  });
});
