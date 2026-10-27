/**
 * Criterio: la pista es tinta sobre la página, pastilla, sin flecha y sin
 * sombra: una etiqueta, no un bocadillo. Entra en --dur-toque con pluma.
 */
import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/shared/testing/render";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./tooltip";

describe("Tooltip", () => {
  it("es una pastilla de tinta sin flecha ni sombra", async () => {
    renderWithProviders(
      <TooltipProvider>
        <Tooltip open>
          <TooltipTrigger>Energía</TooltipTrigger>
          <TooltipContent>Nivel de energía</TooltipContent>
        </Tooltip>
      </TooltipProvider>,
    );
    const pista = (await screen.findAllByText("Nivel de energía"))[0];
    expect(pista.className).toContain("rounded-full");
    expect(pista.className).toContain("bg-foreground");
    expect(pista.className).toContain("text-background");
    expect(pista.className).not.toMatch(/shadow-(?!none)/);
    expect(pista.className).toContain("duration-(--dur-toque)");
    expect(document.querySelector("[data-slot=tooltip-content] svg")).toBeNull();
  });
});
