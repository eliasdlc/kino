/**
 * Criterio: la sección ya no promete «completo» sin el manifiesto al lado, y
 * ofrece las dos descargas por separado, porque los datos y las imágenes ya no
 * caben juntos en el presupuesto de la ruta. Es la pantalla que mentía y
 * ningún test la cubría.
 */
import { describe, expect, it, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import { renderWithProviders } from "@/shared/testing/render";
import { EXPORT_TABLES } from "./export-manifest";
import { DataPortabilitySection } from "./DataPortabilitySection";

vi.mock("next/navigation", async () => (await import("@/shared/testing/navigation")).navigationMock());

describe("DataPortabilitySection", () => {
  it("no promete «completo» en ningún sitio: lo que promete lo enumera el manifiesto", () => {
    renderWithProviders(<DataPortabilitySection />);

    expect(screen.queryByText(/completo/i)).toBeNull();
    expect(screen.getByRole("table")).toBeVisible();
    expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(EXPORT_TABLES.length + 1);
  });

  it("los datos y las imágenes son dos descargas, no una", () => {
    renderWithProviders(<DataPortabilitySection />);

    expect(screen.getByRole("button", { name: "Exportar ZIP" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Bajar imágenes" })).toBeVisible();
  });
});
