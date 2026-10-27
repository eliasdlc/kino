/**
 * Criterio: el segmento es el control de dos a cuatro opciones de Diario. Es
 * un grupo de radios (una sola opción activa, las flechas eligen la siguiente
 * y la anterior), cada opción mide 2.85rem, va sobre sf2 y la elegida se
 * pinta en tinta, no en ámbar: el acento queda para la acción, y elegir un
 * tema no es una acción. Tocar una opción la elige y avisa; cada opción lleva
 * el foco único y transiciona color y transform con pluma.
 */
import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/shared/testing/render";
import { Segmented } from "./segmented";

const TEMAS = [
  { value: "sistema", label: "Sistema" },
  { value: "claro", label: "Claro" },
  { value: "oscuro", label: "Oscuro" },
];

describe("Segmented", () => {
  it("es un grupo de radios sobre sf2 con opciones de 2.85rem y la elegida en tinta", () => {
    renderWithProviders(<Segmented aria-label="Tema" value="claro" options={TEMAS} onValueChange={() => {}} />);
    const grupo = screen.getByRole("radiogroup", { name: "Tema" });
    expect(grupo.className).toContain("bg-secondary");
    expect(grupo.className).toContain("rounded-full");
    const claro = screen.getByRole("radio", { name: "Claro" });
    expect(claro.className).toContain("h-[2.85rem]");
    expect(claro).toHaveAttribute("aria-checked", "true");
    expect(claro.className).toContain("data-on:bg-foreground");
    expect(claro.className).toContain("data-on:text-background");
    expect(claro.className).not.toContain("bg-primary");
    expect(claro.className).toContain("focus-ring");
    expect(claro.className).toMatch(/transition-\[[^\]]*transform[^\]]*\]/);
    expect(claro.className).toContain("ease-(--ease-pluma)");
    expect(screen.getByRole("radio", { name: "Oscuro" })).toHaveAttribute("aria-checked", "false");
  });

  it("tocar una opción la elige y avisa, y no se puede dejar sin elegir", async () => {
    const onValueChange = vi.fn();
    renderWithProviders(<Segmented aria-label="Tema" value="claro" options={TEMAS} onValueChange={onValueChange} />);
    await userEvent.click(screen.getByRole("radio", { name: "Oscuro" }));
    expect(onValueChange).toHaveBeenCalledWith("oscuro");
    await userEvent.click(screen.getByRole("radio", { name: "Claro" }));
    expect(onValueChange).toHaveBeenCalledTimes(1);
  });

  it("las flechas eligen la siguiente y la anterior, y dan la vuelta en los extremos", async () => {
    const onValueChange = vi.fn();
    renderWithProviders(<Segmented aria-label="Tema" value="claro" options={TEMAS} onValueChange={onValueChange} />);
    screen.getByRole("radio", { name: "Claro" }).focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(onValueChange).toHaveBeenLastCalledWith("oscuro");
    await userEvent.keyboard("{ArrowLeft}");
    expect(onValueChange).toHaveBeenLastCalledWith("sistema");
    expect(onValueChange).toHaveBeenCalledTimes(2);
  });
});
