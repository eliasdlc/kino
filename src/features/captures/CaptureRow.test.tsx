/**
 * Criterio: la fila de una captura es la misma fila que la de una tarea, con su
 * marca a la izquierda y el glifo de su tipo en el hueco que Bandeja ya
 * reservaba. Lo que no lleva es casilla: una captura no se completa, se
 * confirma, y confirmar abre otra pantalla.
 */
import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderMobile } from "@/shared/testing/render";
import { CaptureRow } from "./CaptureRow";
import type { CaptureItem } from "./captures.types";

function captura(campos: Partial<CaptureItem> = {}): CaptureItem {
  return {
    id: "cap-1",
    kind: "photo",
    status: "pending",
    text: null,
    url: null,
    blobPath: "k/pizarra.jpg",
    durationSeconds: null,
    proposedItems: null,
    createdAt: 1_757_800_000_000,
    expiresAt: 1_760_392_000_000,
    diasRestantes: 30,
    avisa: false,
    ...campos,
  } as CaptureItem;
}

function pintar(item: CaptureItem, onOpen = vi.fn()) {
  renderMobile(
    <ul>
      <CaptureRow captura={item} onOpen={onOpen} />
    </ul>,
  );
  return onOpen;
}

describe("CaptureRow", () => {
  it("un enlace se lee por su dirección", () => {
    pintar(captura({ kind: "link", url: "https://react.dev/learn" }));

    expect(screen.getByText("https://react.dev/learn")).toBeVisible();
    expect(screen.getByLabelText("link")).toBeInTheDocument();
  });

  it("una foto sin texto dice que es una foto, no un nombre inventado", () => {
    pintar(captura({ kind: "photo" }));

    expect(screen.getByText("Foto")).toBeVisible();
  });

  it("no lleva casilla: una captura no se completa", () => {
    pintar(captura());

    expect(screen.queryByRole("checkbox")).toBeNull();
  });

  it("mientras no toque avisar, la fila no habla de caducidad", () => {
    pintar(captura({ avisa: false, diasRestantes: 30 }));

    expect(screen.queryByText(/Caduca/)).toBeNull();
  });

  it("el aviso llega antes, con los días que quedan", () => {
    pintar(captura({ avisa: true, diasRestantes: 7 }));

    expect(screen.getByText("Caduca en 7 días")).toBeVisible();
  });

  it("el último día se dice en palabras, no en un uno", () => {
    pintar(captura({ avisa: true, diasRestantes: 1 }));

    expect(screen.getByText("Caduca mañana")).toBeVisible();
  });

  it("lo caducado sigue en la lista y lo dice: no desaparece en silencio", () => {
    pintar(captura({ status: "expired", diasRestantes: 0, avisa: false }));

    expect(screen.getByText("Caducó sin confirmar")).toBeVisible();
  });

  it("tocarla la abre", async () => {
    const item = captura({ kind: "text", text: "idea de la tesis" });
    const onOpen = pintar(item);

    await userEvent.click(screen.getByRole("button", { name: /idea de la tesis/ }));

    expect(onOpen).toHaveBeenCalledExactlyOnceWith(item);
  });
});
