/**
 * Criterio: la intensidad es un segmento y la línea de encima promete lo que
 * el servidor va a hacer con la elegida, con las cifras de las mismas
 * constantes; elegir otra la guarda al tocarla; apagar los recordatorios deja
 * quieto el resto de la hoja; y la hoja dice cuándo los avisos no van a
 * llegar (sin dispositivos, sin correo) en vez de prometerlos.
 */
import { describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { api } from "@convex/_generated/api";
import { makeTestConvexClient, renderWithProviders, stubMutation, stubMutationPending, stubQuery } from "@/shared/testing/render";
import { describirIntensidad, horaCorta, RemindersSection } from "./RemindersSection";

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
  it("la intensidad elegida está marcada y la línea dice cuándo suena", () => {
    renderWithProviders(<RemindersSection />, { convex: cliente({ dispositivos: 1, pushConfigurado: true, correoConfigurado: true }) });

    expect(screen.getByRole("radio", { name: "Agresivos" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText(/a 6, 4, 2 y 1 h y a la hora/)).toBeVisible();
    expect(screen.getByText(/cada 3 h hasta que la termines/)).toBeVisible();
    expect(describirIntensidad("low").vencida).toBe("Vencida: cada mañana en el resumen.");
  });

  it("elegir otra intensidad la marca en el acto y la guarda", async () => {
    // La escritura queda en vuelo: lo que se ve mientras tanto es lo elegido,
    // no lo que la cuenta decía antes.
    const enVuelo = stubMutationPending(api.settings.update);
    const convex = makeTestConvexClient(
      [stubQuery(api.settings.get, AJUSTES), stubQuery(api.notifications.estado, { dispositivos: 1, pushConfigurado: true, correoConfigurado: true, email: "ana@usekino.dev" })],
      [enVuelo.stub],
    );
    renderWithProviders(<RemindersSection />, { convex });

    await userEvent.click(screen.getByRole("radio", { name: "Bajos" }));

    expect(screen.getByRole("radio", { name: "Bajos" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText("Vencida: cada mañana en el resumen.")).toBeVisible();
    await waitFor(() =>
      expect(convex.calls).toContainEqual({ kind: "mutation", name: "settings:update", args: { reminderIntensity: "low" } }),
    );
  });

  it("con los recordatorios apagados el resto de la hoja no se puede tocar", () => {
    const convex = makeTestConvexClient(
      [stubQuery(api.settings.get, { ...AJUSTES, notificationsEnabled: false }), stubQuery(api.notifications.estado, { dispositivos: 1, pushConfigurado: true, correoConfigurado: true, email: "ana@usekino.dev" })],
    );
    renderWithProviders(<RemindersSection />, { convex });

    expect(screen.getByRole("switch", { name: "Recibir recordatorios" })).not.toBeChecked();
    expect(screen.getByRole("radio", { name: "Medios" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Enviar una prueba" })).toBeDisabled();
  });

  it("sin dispositivos ni correo lo dice, y la prueba se dispara igual", async () => {
    const convex = cliente({ dispositivos: 0, pushConfigurado: true, correoConfigurado: false });
    renderWithProviders(<RemindersSection />, { convex });

    expect(screen.getByText(/Ningún dispositivo tiene el push activado/)).toBeVisible();
    expect(screen.getByText(/El correo no está configurado/)).toBeVisible();

    await userEvent.click(screen.getByRole("button", { name: /Enviar una prueba/ }));
    expect(convex.calls).toContainEqual({ kind: "action", name: "notifications:probar", args: {} });
  });

  it("la hora del índice se dice corta", () => {
    expect(horaCorta("08:00")).toBe("8:00");
    expect(horaCorta("22:00", false)).toBe("22");
    expect(horaCorta("22:30", false)).toBe("22:30");
  });
});
