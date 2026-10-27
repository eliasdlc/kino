/**
 * Criterio: en el teléfono el panel del editor se queda con lo que escribir
 * necesita. Los atajos de formato son de teclado físico y sólo se enseñan en
 * escritorio; en un dedo el formato vive en la barra del pulgar. En una obra el
 * panel nombra la unidad con su género («Esta escena»), y empezar una sesión
 * cierra el panel antes de abrir el temporizador, sin hojas apiladas.
 */
import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MEDIUM_CONFIG } from "@/shared/lib/mediums";
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

  it("en un guion dice «Esta escena» y la sesión cierra el panel", async () => {
    // El temporizador crea su AudioContext en el gesto; jsdom no lo trae.
    vi.stubGlobal("AudioContext", class { state = "running"; resume() {} });
    const onOpenChange = vi.fn();
    renderMobile(
      <EditorPanel {...props} writer medium={MEDIUM_CONFIG.screenplay} onOpenChange={onOpenChange} />,
    );
    expect(await screen.findByRole("heading", { name: "Esta escena" })).toBeInTheDocument();
    const sesion = screen.getByRole("button", { name: /Empezar una sesión/ });
    expect(sesion).toHaveTextContent("sobre esta escena");
    await userEvent.click(sesion);
    expect(onOpenChange).toHaveBeenCalledWith(false);
    vi.unstubAllGlobals();
  });
});
