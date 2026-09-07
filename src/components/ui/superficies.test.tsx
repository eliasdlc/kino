/**
 * Criterio: las superficies y los overlays obedecen a la elevación de la
 * identidad. Una card es superficie (radio 22) con hairline y la sombra del
 * token, que en oscuro es ninguna; un menú es bloque (radio 18) con sus
 * filas a radio 12; las pestañas son un segmento pill y la activa es el
 * acento. Ninguna lleva el ring gris de shadcn ni una sombra fija.
 */
import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/shared/testing/render";
import { Card, CardTitle } from "./card";
import { Tabs, TabsList, TabsTrigger } from "./tabs";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

describe("las superficies", () => {
  it("la card es superficie con hairline y la sombra del token", () => {
    renderWithProviders(
      <Card data-testid="card">
        <CardTitle>Plan de hoy</CardTitle>
      </Card>,
    );
    const card = screen.getByTestId("card");
    expect(card.className).toContain("rounded-2xl");
    expect(card.className).toContain("border-border");
    expect(card.className).toContain("shadow-(--shadow)");
    expect(card.className).not.toContain("ring-foreground/10");
    expect(screen.getByText("Plan de hoy").className).toContain("font-heading");
  });

  it("el popover es bloque con hairline, sin sombra fija", () => {
    renderWithProviders(
      <Popover open>
        <PopoverTrigger>Abrir</PopoverTrigger>
        <PopoverContent>Contenido</PopoverContent>
      </Popover>,
    );
    const content = screen.getByText("Contenido");
    expect(content.className).toContain("rounded-xl");
    expect(content.className).toContain("border-border");
    expect(content.className).not.toMatch(/shadow-(sm|md|lg)\b/);
  });
});

describe("las pestañas", () => {
  it("son un segmento pill y la activa es el acento", () => {
    renderWithProviders(
      <Tabs defaultValue="hoy">
        <TabsList>
          <TabsTrigger value="hoy">Hoy</TabsTrigger>
          <TabsTrigger value="semana">Semana</TabsTrigger>
        </TabsList>
      </Tabs>,
    );
    const lista = screen.getByRole("tablist");
    expect(lista.className).toContain("rounded-full");
    const activa = screen.getByRole("tab", { name: "Hoy" });
    expect(activa).toHaveAttribute("data-state", "active");
    expect(activa.className).toContain("rounded-full");
    expect(activa.className).toContain("data-active:bg-primary");
    expect(activa.className).not.toMatch(/\[\d+px\]/);
  });
});
