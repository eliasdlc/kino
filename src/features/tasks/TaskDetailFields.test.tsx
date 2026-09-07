/**
 * Criterio: el detalle de una tarea cerrada dice quién la cerró, por qué vía y
 * cuánto trabajo observado tiene, en una sola línea. Cuando no hay firma o no
 * hay tiempo registrado lo dice con el mismo tamaño de letra que cuando los
 * hay, y una tarea sin cerrar no pinta la línea en vez de pintar un hueco.
 */
import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { api } from "@convex/_generated/api";
import { makeTestConvexClient, renderWithProviders, stubQuery } from "@/shared/testing/render";
import { ClosingSignature } from "./TaskDetailFields";
import type { TaskTransport } from "./tasks.types";

const tarea = (firma: Partial<TaskTransport>) =>
  ({ id: "t1", title: "Terminar el capítulo", ...firma }) as unknown as TaskTransport;

const conTiempo = (totalMinutes: number, sessionCount = 1) =>
  makeTestConvexClient([stubQuery(api.tasks.timeLogSummary, { totalMinutes, sessionCount })]);

describe("ClosingSignature", () => {
  it("pinta quién cerró, por qué vía y el tiempo observado", () => {
    renderWithProviders(
      <ClosingSignature task={tarea({ completedAt: "2026-09-07T10:00:00.000Z", completedVia: "session" })} />,
      { convex: conTiempo(95) },
    );
    expect(screen.getByText(/La cerraste tú, desde el navegador · 1h 35min de trabajo observado/)).toBeVisible();
  });

  it("un issue cerrado en GitHub firma la vía sin persona", () => {
    renderWithProviders(
      <ClosingSignature task={tarea({ completedAt: "2026-09-07T10:00:00.000Z", completedVia: "sync" })} />,
      { convex: conTiempo(0, 0) },
    );
    expect(screen.getByText(/La cerró la sincronización con GitHub · sin tiempo observado/)).toBeVisible();
  });

  it("sin firma lo dice, y al mismo tamaño de letra que con firma", () => {
    const { unmount } = renderWithProviders(
      <ClosingSignature task={tarea({ completedAt: "2026-09-07T10:00:00.000Z", completedVia: null })} />,
      { convex: conTiempo(0, 0) },
    );
    const sinFirma = screen.getByText(/Se cerró antes de que existiera la firma/);
    expect(sinFirma).toBeVisible();
    const tamano = sinFirma.className;
    unmount();

    renderWithProviders(
      <ClosingSignature task={tarea({ completedAt: "2026-09-07T10:00:00.000Z", completedVia: "session" })} />,
      { convex: conTiempo(0, 0) },
    );
    expect(screen.getByText(/La cerraste tú/).className).toBe(tamano);
  });

  it("una tarea sin cerrar no pinta la línea", () => {
    renderWithProviders(<ClosingSignature task={tarea({ completedAt: null, completedVia: null })} />, {
      convex: conTiempo(30),
    });
    expect(screen.queryByText("Firma del cierre")).toBeNull();
  });
});
