/**
 * Criterio: los tres estados de llegada (texto o enlace, imagen, audio) y el de
 * error. Y sobre todos, la línea que dice dónde quedó lo compartido: es el
 * único sitio del producto donde esa frase vale, porque aquí ya está guardado
 * antes de que la pantalla exista.
 */
import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderMobile } from "@/shared/testing/render";
import type { RegistroCompartido } from "@/features/captures/shareTarget";
import { CompartirScreen } from "./CompartirScreen";

vi.mock("next/navigation", async () => (await import("@/shared/testing/navigation")).navigationMock());

function registro(campos: Partial<RegistroCompartido>): RegistroCompartido {
  return {
    id: "reg-1",
    ownerId: "user-1",
    kind: "text",
    name: null,
    size: 0,
    text: null,
    url: null,
    receivedAt: 1_757_800_000_000,
    estado: "pendiente",
    blob: null,
    ...campos,
  };
}

describe("CompartirScreen", () => {
  it("un texto compartido se lee entero", () => {
    renderMobile(
      <CompartirScreen registro={registro({ kind: "text", text: "idea de la tesis" })} previewUrl={null} />,
    );

    expect(screen.getByRole("heading", { name: "Guardado" })).toBeVisible();
    expect(screen.getByText("idea de la tesis")).toBeVisible();
  });

  it("un enlace enseña su dirección, no un nombre inventado", () => {
    renderMobile(
      <CompartirScreen registro={registro({ kind: "link", url: "https://react.dev/learn" })} previewUrl={null} />,
    );

    expect(screen.getByText("https://react.dev/learn")).toBeVisible();
  });

  it("una foto se ve, con el nombre del archivo debajo", () => {
    renderMobile(
      <CompartirScreen
        registro={registro({ kind: "photo", name: "pizarra.jpg", size: 2048 })}
        previewUrl="blob:kino/pizarra"
      />,
    );

    expect(screen.getByRole("img", { name: "pizarra.jpg" })).toHaveAttribute("src", "blob:kino/pizarra");
    expect(screen.getByText("pizarra.jpg")).toBeVisible();
  });

  it("una nota de voz trae su control de reproducción, no un dibujo", () => {
    renderMobile(
      <CompartirScreen
        registro={registro({ kind: "voice", name: "nota.m4a", size: 64 })}
        previewUrl="blob:kino/nota"
      />,
    );

    expect(screen.getByRole("button", { name: /Reproducir la nota de voz/ })).toBeVisible();
  });

  it("mientras no ha subido, dice que salió sin red y sale solo", () => {
    renderMobile(<CompartirScreen registro={registro({ text: "idea" })} previewUrl={null} />);

    expect(screen.getByText(/Sale solo cuando vuelva la red/)).toBeVisible();
  });

  it("cuando ya subió, dice exactamente dónde está", () => {
    renderMobile(
      <CompartirScreen registro={registro({ text: "idea", estado: "subida" })} previewUrl={null} />,
    );

    expect(screen.getByText("Está en Bandeja, sin confirmar.")).toBeVisible();
  });

  it("si el recibo no aparece, dice dónde quedó en vez de mandar a un error", () => {
    renderMobile(<CompartirScreen registro={null} previewUrl={null} perdido />);

    expect(screen.getByRole("heading", { name: "No encontramos esto" })).toBeVisible();
    expect(screen.getByText(/sigue en la cola del teléfono/)).toBeVisible();
  });

  it("las dos salidas están siempre, y llevan a donde dicen", () => {
    renderMobile(<CompartirScreen registro={registro({ text: "idea" })} previewUrl={null} />);

    expect(screen.getByRole("link", { name: "Abrir Bandeja" })).toHaveAttribute("href", "/bandeja");
    expect(screen.getByRole("link", { name: "Compartir otra cosa" })).toHaveAttribute("href", "/dashboard");
  });
});

describe("cuando no se pudo guardar", () => {
  it("dice el motivo y que sigue en el teléfono, en vez de prometer que sale sola", () => {
    renderMobile(
      <CompartirScreen
        registro={registro({ kind: "photo", name: "pizarra.jpg" })}
        previewUrl={null}
        problema="La foto pesa más de 4 MB incluso comprimida y no se pudo guardar en Kino. Sigue en el teléfono, no se perdió."
      />,
    );

    expect(screen.getByRole("heading", { name: "No se pudo guardar" })).toBeVisible();
    expect(screen.getByText(/pesa más de 4 MB/)).toBeVisible();
    expect(screen.getByText(/Sigue en el teléfono, no se perdió/)).toBeVisible();
    // La promesa que no se puede cumplir no aparece por ningún lado.
    expect(screen.queryByText(/Sale solo cuando vuelva la red/)).toBeNull();
  });

  it("sin problema declarado, sin red sigue diciendo que sale sola", () => {
    renderMobile(<CompartirScreen registro={registro({ text: "idea" })} previewUrl={null} problema={null} />);

    expect(screen.getByText(/Sale solo cuando vuelva la red/)).toBeVisible();
  });

  it("lo que ya subió no habla de problemas aunque hubiera habido uno antes", () => {
    renderMobile(
      <CompartirScreen registro={registro({ text: "idea", estado: "subida" })} previewUrl={null} problema={null} />,
    );

    expect(screen.getByText("Está en Bandeja, sin confirmar.")).toBeVisible();
  });
});
