/**
 * Criterio: en Diario nada en la página tiene sombra. La card es una
 * superficie con hairline y radio 1.125rem, sin sombra en ningún modo; el
 * popover y el menú son bloques con hairline y sin sombra. La única sombra es
 * el token `--shadow` (ninguna en oscuro) y la llevan sólo el diálogo y las
 * hojas. La hoja inferior trae asa y un botón Cerrar visible, y el pie del
 * diálogo no sangra una banda gris. Las pestañas siguen siendo un segmento
 * pill y la activa el acento.
 */
import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/shared/testing/render";
import { Card, CardTitle } from "./card";
import { Tabs, TabsList, TabsTrigger } from "./tabs";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { Dialog, DialogContent, DialogFooter, DialogTitle } from "./dialog";
import { Drawer, DrawerContent, DrawerTitle } from "./drawer";

describe("las superficies", () => {
  it("la card es superficie con hairline y sin sombra", () => {
    renderWithProviders(
      <Card data-testid="card">
        <CardTitle>Plan de hoy</CardTitle>
      </Card>,
    );
    const card = screen.getByTestId("card");
    expect(card.className).toContain("rounded-xl");
    expect(card.className).toContain("border-border");
    expect(card.className).not.toMatch(/shadow-(?!none)/);
    expect(card.className).not.toContain("ring-foreground/10");
    expect(screen.getByText("Plan de hoy").className).toContain("font-heading");
  });

  it("el popover es bloque con hairline, sin sombra", () => {
    renderWithProviders(
      <Popover open>
        <PopoverTrigger>Abrir</PopoverTrigger>
        <PopoverContent>Contenido</PopoverContent>
      </Popover>,
    );
    const content = screen.getByText("Contenido");
    expect(content.className).toContain("rounded-xl");
    expect(content.className).toMatch(/\bborder-(border|ln2)\b/);
    expect(content.className).not.toMatch(/shadow-(?!none)/);
  });
});

describe("los overlays", () => {
  it("el diálogo lleva la sombra del token y su pie no sangra una banda", () => {
    renderWithProviders(
      <Dialog open>
        <DialogContent>
          <DialogTitle>Editar sistema</DialogTitle>
          <DialogFooter data-testid="pie">Acciones</DialogFooter>
        </DialogContent>
      </Dialog>,
    );
    const dialogo = screen.getByRole("dialog");
    expect(dialogo.className).toContain("shadow-(--shadow)");
    expect(dialogo.className).not.toContain("shadow-lg");
    expect(screen.getByText("Editar sistema").className).toContain("font-display");
    const pie = screen.getByTestId("pie");
    expect(pie.className).not.toContain("bg-muted");
    expect(pie.className).not.toContain("-mx-5");
    expect(screen.getByRole("button", { name: "Cerrar" })).toBeInTheDocument();
  });

  it("la hoja inferior trae asa y botón Cerrar visible", () => {
    renderWithProviders(
      <Drawer open>
        <DrawerContent>
          <DrawerTitle>Detalle</DrawerTitle>
        </DrawerContent>
      </Drawer>,
    );
    expect(screen.getByRole("button", { name: "Cerrar" })).toBeInTheDocument();
    expect(document.querySelector("[data-slot=drawer-handle]")).not.toBeNull();
    expect(screen.getByText("Detalle").className).toContain("font-display");
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
    expect(activa.className).toContain("focus-ring");
    expect(activa.className).not.toMatch(/\[\d+px\]/);
  });
});
