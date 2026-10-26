/**
 * Criterio: todo llega marcado, desmarcar lo que no sirve cuesta un toque,
 * confirmar dice cuántos va a crear y a dónde fueron, y descartar la captura
 * entera es otro toque también cuando el agente propuso algo. Y ningún control
 * se pinta sin comportamiento: una captura que nadie ha leído no enseña una
 * lista vacía, y ofrece dejarla donde está además de descartarla.
 */
import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { api } from "@convex/_generated/api";
import { makeSystem, mid } from "@/app/system-design/mock-data";
import { makeTestConvexClient, renderMobile, stubQuery } from "@/shared/testing/render";
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

    expect(onConfirm).toHaveBeenCalledExactlyOnceWith([0, 2], [{ systemId: null, nombre: "Bandeja", cuenta: 2 }]);
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

  it("la que nadie leyó se puede dejar donde está, sin descartarla", async () => {
    const onOpenChange = vi.fn();
    const onDiscard = vi.fn();
    renderMobile(
      <ShareConfirm captura={captura({ proposedItems: null })} open onOpenChange={onOpenChange} onConfirm={vi.fn()} onDiscard={onDiscard} />,
    );

    expect(screen.getByRole("link", { name: "Cómo conectar tu agente" })).toHaveAttribute("href", "/docs#mcp");
    await userEvent.click(screen.getByRole("button", { name: "Dejarla aquí" }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onDiscard).not.toHaveBeenCalled();
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

    expect(screen.getByText(/Tesis/)).toBeVisible();
  });

  it("cada item dice a dónde va: el sistema propuesto o Bandeja", () => {
    pintar();

    expect(screen.getAllByText(/^a Bandeja/)).toHaveLength(PROPUESTOS.length);
  });

  it("una captura mal leída se descarta entera sin desmarcar uno por uno", async () => {
    const { onDiscard, onConfirm } = pintar();

    await userEvent.click(screen.getByRole("button", { name: "Descartar la captura" }));

    expect(onDiscard).toHaveBeenCalledOnce();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("lo que se desmarcó en una captura no pasa a la siguiente", async () => {
    const ver = (item: CaptureItem | null, open: boolean) => (
      <ShareConfirm captura={item} open={open} onOpenChange={() => {}} onConfirm={vi.fn()} onDiscard={vi.fn()} />
    );
    const { rerender } = renderMobile(ver(captura(), true));
    await userEvent.click(screen.getByRole("button", { name: /Repasar el parcial/ }));
    expect(screen.getByRole("button", { name: "Confirmar 2" })).toBeVisible();

    // Bandeja cierra la hoja vaciando la captura, no por el diálogo.
    rerender(ver(null, false));
    rerender(ver(captura({ id: "cap-2" as CaptureItem["id"] }), true));

    expect(screen.getByRole("button", { name: "Confirmar 3" })).toBeVisible();
  });

  it("una captura caducada lo dice y no ofrece Confirmar, que el servidor rechaza", async () => {
    const { onConfirm, onDiscard } = pintar(captura({ status: "expired", diasRestantes: 0 }));

    expect(screen.getByText("Caducó sin confirmar")).toBeVisible();
    expect(screen.queryByRole("button", { name: /Confirmar|No queda nada marcado/ })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Descartarla" }));
    expect(onDiscard).toHaveBeenCalledOnce();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("un item propuesto para un sistema dice su nombre y confirma contándolo en ese destino", async () => {
    const tesis = makeSystem({ id: mid("sys-1"), name: "Tesis" });
    const onConfirm = vi.fn();
    renderMobile(
      <ShareConfirm
        captura={captura({ proposedItems: [{ title: "Escribir la intro", systemId: tesis.id }, { title: "Pedir la rúbrica" }] })}
        open
        onOpenChange={() => {}}
        onConfirm={onConfirm}
        onDiscard={vi.fn()}
      />,
      { convex: makeTestConvexClient([stubQuery(api.systems.list, [tesis])]) },
    );

    expect(screen.getByText(/^a Tesis/)).toBeVisible();
    expect(screen.getByText(/^a Bandeja/)).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Confirmar 2" }));

    expect(onConfirm).toHaveBeenCalledExactlyOnceWith(
      [0, 1],
      [
        { systemId: tesis.id, nombre: "Tesis", cuenta: 1 },
        { systemId: null, nombre: "Bandeja", cuenta: 1 },
      ],
    );
  });
});
