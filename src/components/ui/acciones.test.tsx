/**
 * Criterio: las primitivas de acción y formulario obedecen a la geometría de
 * la identidad. Un botón es un pill con altura en rem y la acción primaria
 * lleva el glow del acento, nunca una sombra; un campo tiene radio 16 y la
 * misma altura que el botón, así que un formulario alinea sin ajustes. Si
 * alguien vuelve a los 40 px o al rectángulo, falla aquí y no en una captura.
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
  it("el botón es un pill con altura en rem y la primaria lleva el glow", () => {
    renderWithProviders(<Button>Guardar</Button>);
    const boton = screen.getByRole("button", { name: "Guardar" });
    expect(boton).toBeVisible();
    expect(boton.className).toContain("rounded-full");
    expect(boton.className).toContain("h-[2.85rem]");
    expect(boton.className).toContain("var(--glow)");
    expect(boton.className).not.toMatch(/\[\d+px\]/);
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
  it("el campo y el área tienen radio 16 y la altura del botón", () => {
    renderWithProviders(
      <>
        <Label htmlFor="titulo">Título</Label>
        <Input id="titulo" placeholder="Qué vas a hacer" />
        <Textarea aria-label="Notas" />
      </>,
    );
    const campo = screen.getByLabelText("Título");
    expect(campo.className).toContain("rounded-lg");
    expect(campo.className).toContain("h-[2.85rem]");
    expect(screen.getByLabelText("Notas").className).toContain("rounded-lg");
    expect(screen.getByText("Título").className).toContain("font-semibold");
  });

  it("el interruptor encendido es el acento y apagado es superficie, sin px", () => {
    renderWithProviders(<Switch aria-label="Recordatorios" defaultChecked />);
    const sw = screen.getByRole("switch", { name: "Recordatorios" });
    expect(sw).toBeChecked();
    expect(sw.className).toContain("data-checked:bg-primary");
    expect(sw.className).toContain("data-unchecked:bg-secondary");
    expect(sw.className).not.toMatch(/\[\d+px\]/);
  });
});
