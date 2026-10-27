/**
 * Criterio: crear una tarea desde un sistema tiene nombre también en el
 * teléfono, donde el botón es sólo un `+` junto al `+` del pie. El nombre
 * dice qué crea, y tocarlo abre el diálogo de la tarea nueva.
 */
import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderMobile } from "@/shared/testing/render";
import { MOCK_SYSTEM_ID } from "@/app/system-design/mock-data";
import { NewTaskButton } from "./NewTaskButton";

vi.mock("next/navigation", async () => (await import("@/shared/testing/navigation")).navigationMock());

describe("NewTaskButton", () => {
  it("en el teléfono el + dice qué crea y abre la tarea nueva", async () => {
    renderMobile(<NewTaskButton systemId={MOCK_SYSTEM_ID} />);
    const boton = screen.getByRole("button", { name: "Nueva tarea en este sistema" });
    await userEvent.click(boton);
    expect(await screen.findByRole("heading", { name: "Nueva tarea" })).toBeInTheDocument();
  });
});
