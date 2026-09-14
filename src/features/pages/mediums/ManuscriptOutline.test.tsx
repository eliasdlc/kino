import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/shared/testing/render";
import { ManuscriptOutline } from "./ManuscriptOutline";
import type { OutlineItem } from "./outline";

/**
 * Criterio: la lista del panel enseña todas las entradas del índice con su
 * sangría y salta a la que se toca. Es la única navegación que le queda a un
 * documento en un teléfono, donde el carril no se pinta, y el mismo componente
 * lo usa el manuscrito con su propio encabezado.
 */

function heading(pos: number, label: string, depth = 0): OutlineItem {
  return { pos, label, depth, kind: "heading", preview: null };
}

const APUNTE = [
  heading(0, "Análisis léxico"),
  heading(40, "Autómatas finitos", 1),
  heading(90, "AFD contra AFND", 2),
  heading(140, "Tabla de símbolos", 1),
];

describe("ManuscriptOutline", () => {
  it("enseña una entrada por título, sangrada según su nivel", () => {
    renderWithProviders(
      <ManuscriptOutline items={APUNTE} heading="En este documento" onJump={vi.fn()} />,
    );

    expect(screen.getByText("En este documento")).toBeVisible();
    const entradas = screen.getAllByRole("button");
    expect(entradas).toHaveLength(4);
    expect(entradas[0]).toHaveStyle({ paddingLeft: "0.25rem" });
    expect(entradas[1]).toHaveStyle({ paddingLeft: "1rem" });
    expect(entradas[2]).toHaveStyle({ paddingLeft: "1.75rem" });
  });

  it("tocar una entrada salta a la posición de su título", async () => {
    const onJump = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <ManuscriptOutline items={APUNTE} heading="En este documento" onJump={onJump} />,
    );

    await user.click(screen.getByRole("button", { name: /Tabla de símbolos/ }));
    expect(onJump).toHaveBeenCalledExactlyOnceWith(140);
  });

  it("el encabezado lo pone quien la usa, y el manuscrito dice lo suyo", () => {
    renderWithProviders(
      <ManuscriptOutline items={APUNTE} heading="En este capítulo" onJump={vi.fn()} />,
    );

    expect(screen.getByText("En este capítulo")).toBeVisible();
    expect(screen.queryByText("En este documento")).not.toBeInTheDocument();
  });

  it("sin entradas dice qué abre la primera, en vez de una lista vacía", () => {
    renderWithProviders(
      <ManuscriptOutline items={[]} heading="En este capítulo" onJump={vi.fn()} />,
    );

    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(screen.getByText(/Un separador o un título abren la primera/)).toBeVisible();
  });
});
