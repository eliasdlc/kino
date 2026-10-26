/**
 * Criterio: el color y el ícono de un sistema son un radiogroup de verdad, con
 * una sola parada de Tab. Se entra por el elegido, las flechas mueven el foco y
 * eligen a la vez, Inicio y Fin van a los extremos. Sin esto, once colores y
 * veintiún iconos eran 32 tabulaciones antes de llegar a Guardar.
 */
import { useState } from "react";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "@/shared/testing/render";
import { SystemColorPicker, SystemIconPicker } from "./SystemPickers";

function Colores({ inicial = "blue" }: { inicial?: string }) {
  const [color, setColor] = useState(inicial);
  return (
    <>
      <button type="button">Antes</button>
      <SystemColorPicker value={color} onChange={setColor} />
      <button type="button">Después</button>
    </>
  );
}

function Iconos() {
  const [icon, setIcon] = useState("feather");
  return <SystemIconPicker value={icon} color="purple" onChange={setIcon} />;
}

describe("SystemColorPicker", () => {
  it("es una sola parada de Tab, y entra por el color elegido", async () => {
    const user = userEvent.setup();
    renderWithProviders(<Colores />);

    const tabbables = screen.getAllByRole("radio").filter((r) => r.getAttribute("tabindex") === "0");
    expect(tabbables).toHaveLength(1);

    await user.click(screen.getByRole("button", { name: "Antes" }));
    await user.tab();
    expect(screen.getByRole("radio", { name: "Azul" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "Después" })).toHaveFocus();
  });

  it("las flechas mueven el foco y eligen; Inicio y Fin van a los extremos", async () => {
    const user = userEvent.setup();
    renderWithProviders(<Colores inicial="red" />);

    screen.getByRole("radio", { name: "Rojo" }).focus();
    await user.keyboard("{ArrowRight}");
    const azul = screen.getByRole("radio", { name: "Azul" });
    expect(azul).toHaveFocus();
    expect(azul).toHaveAttribute("aria-checked", "true");
    expect(azul).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("radio", { name: "Rojo" })).toHaveAttribute("aria-checked", "false");

    await user.keyboard("{ArrowLeft}{ArrowLeft}");
    expect(screen.getByRole("radio", { name: "Blanco" })).toHaveFocus();

    await user.keyboard("{Home}");
    expect(screen.getByRole("radio", { name: "Rojo" })).toHaveAttribute("aria-checked", "true");
    await user.keyboard("{End}");
    expect(screen.getByRole("radio", { name: "Blanco" })).toHaveAttribute("aria-checked", "true");
  });
});

describe("SystemIconPicker", () => {
  it("el mismo grupo para los iconos: flecha abajo elige el siguiente", async () => {
    const user = userEvent.setup();
    renderWithProviders(<Iconos />);

    expect(screen.getAllByRole("radio").filter((r) => r.getAttribute("tabindex") === "0")).toEqual([
      screen.getByRole("radio", { name: "Pluma" }),
    ]);

    screen.getByRole("radio", { name: "Pluma" }).focus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("radio", { name: "Código" })).toHaveFocus();
    expect(screen.getByRole("radio", { name: "Código" })).toHaveAttribute("aria-checked", "true");
  });
});
