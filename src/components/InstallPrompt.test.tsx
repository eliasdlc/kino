/**
 * Criterio: la tarjeta aparece una vez y no vuelve tras descartarse. Es lo
 * único que impide que la invitación a instalar se convierta en la cosa que se
 * descarta todos los días.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderMobile } from "@/shared/testing/render";
import { InstallPrompt } from "./InstallPrompt";

const CLAVE = "kino-install-prompt-dismissed";

/** El evento que el navegador dispara cuando la app se puede instalar. */
function ofreceInstalar() {
  const evento = new Event("beforeinstallprompt");
  Object.assign(evento, {
    prompt: vi.fn(async () => {}),
    userChoice: Promise.resolve({ outcome: "accepted" as const }),
  });
  window.dispatchEvent(evento);
  return evento as Event & { prompt: () => Promise<void> };
}

beforeEach(() => {
  localStorage.clear();
  vi.spyOn(window, "matchMedia").mockReturnValue({ matches: false } as MediaQueryList);
});

describe("InstallPrompt", () => {
  it("no se pinta hasta que el navegador dice que se puede instalar", () => {
    renderMobile(<InstallPrompt />);

    expect(screen.queryByText("Instalar Kino")).toBeNull();
  });

  it("aparece cuando el navegador lo ofrece", async () => {
    renderMobile(<InstallPrompt />);

    ofreceInstalar();

    expect(await screen.findByText("Instalar Kino")).toBeVisible();
  });

  it("descartarla la quita y lo deja escrito", async () => {
    renderMobile(<InstallPrompt />);
    ofreceInstalar();
    await screen.findByText("Instalar Kino");

    await userEvent.click(screen.getByRole("button", { name: "Descartar" }));

    expect(screen.queryByText("Instalar Kino")).toBeNull();
    expect(localStorage.getItem(CLAVE)).toBe("true");
  });

  it("una vez descartada no vuelve, aunque el navegador insista", async () => {
    localStorage.setItem(CLAVE, "true");
    renderMobile(<InstallPrompt />);

    ofreceInstalar();

    expect(screen.queryByText("Instalar Kino")).toBeNull();
  });

  it("instalada ya, no se ofrece instalarla", () => {
    vi.spyOn(window, "matchMedia").mockReturnValue({ matches: true } as MediaQueryList);
    renderMobile(<InstallPrompt />);

    ofreceInstalar();

    expect(screen.queryByText("Instalar Kino")).toBeNull();
  });

  it("instalar la acepta y la tarjeta se va", async () => {
    renderMobile(<InstallPrompt />);
    const evento = ofreceInstalar();
    await screen.findByText("Instalar Kino");

    await userEvent.click(screen.getByRole("button", { name: /Instalar$/ }));

    expect(evento.prompt).toHaveBeenCalledOnce();
    expect(screen.queryByText("Instalar Kino")).toBeNull();
  });
});
