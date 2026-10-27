/**
 * Criterio: las primitivas de acción y formulario obedecen a la geometría de
 * Diario. Un botón es un pill de 2.85rem (el táctil mínimo) y la acción
 * primaria se distingue por el ámbar, sin sombra ni halo; `xs` y `sm` no bajan
 * de ese táctil en el teléfono y sólo encogen desde `md` con puntero fino. Un campo es un pill
 * de la misma altura y el área una superficie de 1.125rem. Todos comparten un
 * único foco visible (`focus-ring`), y el interruptor amplía su zona de toque
 * a 2.85rem sin agrandar el dibujo.
 */
import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/shared/testing/render";
import { Button } from "./button";
import { Input } from "./input";
import { Label } from "./label";
import { Switch } from "./switch";
import { Textarea } from "./textarea";

describe("las primitivas de acción", () => {
  it("el botón es un pill de 2.85rem con el foco único y la primaria no lleva sombra ni halo", () => {
    renderWithProviders(<Button>Guardar</Button>);
    const boton = screen.getByRole("button", { name: "Guardar" });
    expect(boton).toBeVisible();
    expect(boton.className).toContain("rounded-full");
    expect(boton.className).toContain("h-[2.85rem]");
    expect(boton.className).not.toMatch(/shadow|var\(--glow\)/);
    expect(boton.className).toContain("focus-ring");
    expect(boton.className).not.toContain("ring-3");
    expect(boton.className).not.toMatch(/\[\d+px\]/);
  });

  it("xs y sm miden el táctil en el teléfono y sólo encogen desde md", () => {
    renderWithProviders(
      <>
        <Button size="xs">Deshacer</Button>
        <Button size="sm">Mover</Button>
        <Button size="icon-xs" aria-label="Cerrar">x</Button>
      </>,
    );
    for (const nombre of ["Deshacer", "Mover"]) {
      const b = screen.getByRole("button", { name: nombre });
      expect(b.className).toContain("h-[2.85rem]");
      expect(b.className).toMatch(/\bmd:pointer-fine:h-/);
    }
    const icono = screen.getByRole("button", { name: "Cerrar" });
    expect(icono.className).toContain("size-[2.85rem]");
    expect(icono.className).toMatch(/\bmd:pointer-fine:size-/);
  });

  it("la acción primaria grande mide 3.2rem y los iconos son círculos", () => {
    renderWithProviders(
      <>
        <Button size="lg">Registrar energía</Button>
        <Button size="icon" aria-label="Crear">+</Button>
      </>,
    );
    expect(screen.getByRole("button", { name: "Registrar energía" }).className).toContain("h-[3.2rem]");
    expect(screen.getByRole("button", { name: "Crear" }).className).toContain("size-[2.85rem]");
  });
});

describe("las primitivas de formulario", () => {
  it("el campo es un pill de la altura del botón y el área una superficie", () => {
    renderWithProviders(
      <>
        <Label htmlFor="titulo">Título</Label>
        <Input id="titulo" placeholder="Qué vas a hacer" />
        <Textarea aria-label="Notas" />
      </>,
    );
    const campo = screen.getByLabelText("Título");
    expect(campo.className).toContain("rounded-full");
    expect(campo.className).toContain("h-[2.85rem]");
    expect(campo.className).toContain("focus-ring");
    const area = screen.getByLabelText("Notas");
    expect(area.className).toContain("rounded-xl");
    expect(area.className).toContain("focus-ring");
    expect(screen.getByText("Título").className).toContain("font-semibold");
  });

  it("el interruptor encendido es el acento, apagado es superficie, su zona de toque mide 2.85rem y el pulgar lleva hairline", () => {
    renderWithProviders(<Switch aria-label="Recordatorios" defaultChecked />);
    const sw = screen.getByRole("switch", { name: "Recordatorios" });
    expect(sw).toBeChecked();
    expect(sw.className).toContain("data-checked:bg-primary");
    expect(sw.className).toContain("data-unchecked:bg-secondary");
    expect(sw.className).toContain("after:-inset-y-[0.8rem]");
    expect(sw.className).toContain("focus-ring");
    expect(sw.className).not.toMatch(/\[\d+px\]/);
    expect(sw.querySelector("[data-slot=switch-thumb]")?.className).toContain("border-ln2");
  });

  it("el botón transiciona color y transform con pluma, nunca la sombra", () => {
    renderWithProviders(<Button>Guardar</Button>);
    const boton = screen.getByRole("button", { name: "Guardar" });
    expect(boton.className).toContain("press");
    expect(boton.className).toMatch(/transition-\[[^\]]*transform[^\]]*\]/);
    expect(boton.className).not.toMatch(/transition-\[[^\]]*box-shadow/);
    expect(boton.className).toContain("ease-(--ease-pluma)");
  });
});
