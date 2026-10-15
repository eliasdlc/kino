/**
 * Criterio: cada intensidad promete lo que el servidor va a hacer, con las
 * cifras de las mismas constantes; elegir una la guarda en la cuenta; y la
 * sección dice cuándo los avisos no van a llegar (sin dispositivos, sin correo)
 * en vez de prometerlos. La prueba se dispara desde su botón.
 */
import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { api } from "@convex/_generated/api";
import { makeTestConvexClient, renderWithProviders, stubMutation, stubQuery } from "@/shared/testing/render";
import { RemindersSection } from "./RemindersSection";

const AJUSTES = {
  dailyEnergyLimit: 50,
  timezone: "America/Santo_Domingo",
  theme: "system" as const,
  notificationsEnabled: true,
  weeklyReviewDay: "sun" as const,
  wordsSeen: [],
  reminderIntensity: "aggressive" as const,
  quietHoursStart: "22:00",
  quietHoursEnd: "07:00",
  morningDigestTime: "08:00",
  emailReminders: true,
};

function cliente(estado: { dispositivos: number; pushConfigurado: boolean; correoConfigurado: boolean }) {
  return makeTestConvexClient(
    [stubQuery(api.settings.get, AJUSTES), stubQuery(api.notifications.estado, { ...estado, email: "ana@usekino.dev" })],
    [stubMutation(api.settings.update, AJUSTES)],
  );
}

describe("RemindersSection", () => {
  it("cada intensidad dice cuándo suena, y la elegida está marcada", () => {
    renderWithProviders(<RemindersSection />, { convex: cliente({ dispositivos: 1, pushConfigurado: true, correoConfigurado: true }) });

    const agresivos = screen.getByRole("radio", { name: /Agresivos/ });
    expect(agresivos).toHaveAttribute("aria-checked", "true");
    expect(agresivos).toHaveTextContent("a 6, 4, 2 y 1 h y a la hora");
    expect(agresivos).toHaveTextContent("cada 3 h hasta que la termines");
    expect(screen.getByRole("radio", { name: /Bajos/ })).toHaveTextContent("cada mañana en el resumen");
  });

  it("elegir otra intensidad la guarda en la cuenta", async () => {
    const convex = cliente({ dispositivos: 1, pushConfigurado: true, correoConfigurado: true });
    renderWithProviders(<RemindersSection />, { convex });

    await userEvent.click(screen.getByRole("radio", { name: /Medios/ }));

    expect(convex.calls).toContainEqual({ kind: "mutation", name: "settings:update", args: { reminderIntensity: "medium" } });
  });

  it("sin dispositivos ni correo lo dice, y la prueba se dispara igual", async () => {
    const convex = cliente({ dispositivos: 0, pushConfigurado: true, correoConfigurado: false });
    renderWithProviders(<RemindersSection />, { convex });

    expect(screen.getByText(/Ningún dispositivo tiene el push activado/)).toBeVisible();
    expect(screen.getByText(/El correo todavía no está configurado/)).toBeVisible();

    await userEvent.click(screen.getByRole("button", { name: /Enviar una prueba/ }));
    expect(convex.calls).toContainEqual({ kind: "action", name: "notifications:probar", args: {} });
  });
});
