/**
 * Criterio: todo llega marcado, desmarcar lo que no sirve cuesta un toque, y
 * confirmar dice cuántos va a crear. Y ningún control se pinta sin
 * comportamiento: una captura que nadie ha leído no enseña una lista vacía con
 * un botón que no haría nada.
 */
import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderMobile } from "@/shared/testing/render";
import { ShareConfirm } from "./ShareConfirm";
import type { CaptureItem } from "./captures.types";

const PROPUESTOS = [
  { title: "Repasar el parcial", notes: "Tesis" },
  { title: "Entregar el diagrama ER" },
  { title: "Preguntar por la rúbrica" },
];

function captura(campos: Partial<CaptureItem> = {}): CaptureItem {
  return {
    id: "cap-1",
    kind: "photo",
    status: "pending",
    text: null,
    url: null,
    blobPath: "k/pizarra.jpg",
    durationSeconds: null,
    proposedItems: PROPUESTOS,
    createdAt: 1_757_800_000_000,
    expiresAt: 1_760_392_000_000,
    diasRestantes: 30,
    avisa: false,
    ...campos,
  } as CaptureItem;
}

function pintar(item = captura(), onConfirm = vi.fn(), onDiscard = vi.fn()) {
  renderMobile(
    <ShareConfirm captura={item} open onOpenChange={() => {}} onConfirm={onConfirm} onDiscard={onDiscard} />,
  );
  return { onConfirm, onDiscard };
}

describe("ShareConfirm", () => {
  it("los tres items llegan marcados y el botón dice cuántos son", () => {
    pintar();

    for (const item of PROPUESTOS) {
      expect(screen.getByRole("button", { name: new RegExp(item.title) })).toHaveAttribute("aria-pressed", "true");
    }
    expect(screen.getByRole("button", { name: "Confirmar 3" })).toBeEnabled();
  });

  it("desmarcar uno baja la cuenta del botón", async () => {
    pintar();

    await userEvent.click(screen.getByRole("button", { name: /Entregar el diagrama ER/ }));

    expect(screen.getByRole("button", { name: "Confirmar 2" })).toBeVisible();
  });

  it("confirma sólo los índices que quedaron marcados", async () => {
    const { onConfirm } = pintar();

    await userEvent.click(screen.getByRole("button", { name: /Entregar el diagrama ER/ }));
    await userEvent.click(screen.getByRole("button", { name: "Confirmar 2" }));

    expect(onConfirm).toHaveBeenCalledExactlyOnceWith([0, 2]);
  });

  it("sin nada marcado el botón lo dice y no deja confirmar", async () => {
    pintar();

    for (const item of PROPUESTOS) {
      await userEvent.click(screen.getByRole("button", { name: new RegExp(item.title) }));
    }

    expect(screen.getByRole("button", { name: "No queda nada marcado" })).toBeDisabled();
  });

  it("una captura que nadie leyó lo dice y ofrece la salida, sin lista vacía", () => {
    const { onConfirm } = pintar(captura({ proposedItems: null }));

    expect(screen.getByText(/Pídele a tu agente que lea esta captura/)).toBeVisible();
    expect(screen.queryByRole("button", { name: /Confirmar/ })).toBeNull();
    expect(screen.getByRole("button", { name: "Descartarla" })).toBeVisible();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("descartar la que nadie leyó es una decisión, y se pide una vez", async () => {
    const { onDiscard } = pintar(captura({ proposedItems: null }));

    await userEvent.click(screen.getByRole("button", { name: "Descartarla" }));

    expect(onDiscard).toHaveBeenCalledOnce();
  });

  it("una nota de voz trae su reproducción dentro de la confirmación", () => {
    pintar(captura({ kind: "voice", blobPath: "blob:kino/nota", durationSeconds: 47 }));

    expect(screen.getByRole("button", { name: /Reproducir la nota de voz/ })).toBeVisible();
  });

  it("la nota que el agente puso en un item se lee debajo de su título", () => {
    pintar();

    expect(screen.getByText("Tesis")).toBeVisible();
  });
});
