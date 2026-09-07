/**
 * Criterio: al volver de una ausencia, bajo el plan aparece una línea con las
 * cifras de lo que pasó. Cuando no hay datos de energía de esos días lo dice en
 * la misma frase y con el mismo tamaño de letra, no en gris pequeño al final.
 * Sin ausencia no se pinta nada.
 */
import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { api } from "@convex/_generated/api";
import { makeTestConvexClient, renderWithProviders, stubQuery } from "@/shared/testing/render";
import { ReturnNotice } from "./ReturnNotice";

const conAusencia = (value: Parameters<typeof stubQuery<typeof api.today.returnNotice>>[1]) =>
  makeTestConvexClient([stubQuery(api.today.returnNotice, value)]);

const catorceDias = {
  dias: 14,
  ultimaSesion: "2026-08-24T10:00:00.000Z",
  vencidas: 9,
  repetidas: 2,
  conEnergia: false,
};

describe("ReturnNotice", () => {
  it("dice cuándo fue la última sesión y las dos cifras de lo que pasó", () => {
    renderWithProviders(<ReturnNotice />, { convex: conAusencia({ ...catorceDias, conEnergia: true }) });
    const linea = screen.getByText(/Última sesión/);
    expect(linea).toHaveTextContent("9 tareas vencieron mientras tanto y 2 se repitieron solas.");
    // Con datos de energía no se menciona el hueco: no hay nada que no se sepa.
    expect(linea).not.toHaveTextContent("datos de energía");
  });

  it("sin datos de energía lo dice en la misma frase y al mismo tamaño de letra", () => {
    const conDatos = renderWithProviders(<ReturnNotice />, {
      convex: conAusencia({ ...catorceDias, conEnergia: true }),
    });
    const tamano = screen.getByText(/Última sesión/).className;
    conDatos.unmount();

    renderWithProviders(<ReturnNotice />, { convex: conAusencia(catorceDias) });
    const sinDatos = screen.getByText(/Última sesión/);
    expect(sinDatos).toHaveTextContent("No hay datos de energía de estos 14 días");
    expect(sinDatos.className).toBe(tamano);
  });

  it("una sola tarea y una sola recurrencia se dicen en singular", () => {
    renderWithProviders(<ReturnNotice />, {
      convex: conAusencia({ ...catorceDias, vencidas: 1, repetidas: 1, conEnergia: true }),
    });
    expect(screen.getByText(/Última sesión/)).toHaveTextContent("1 tarea venció mientras tanto y 1 se repitió sola.");
  });

  it("sin ausencia no se pinta nada", () => {
    const { container } = renderWithProviders(<ReturnNotice />, { convex: conAusencia(null) });
    expect(container).toBeEmptyDOMElement();
  });
});
