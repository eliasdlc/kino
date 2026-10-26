/**
 * Criterio: una carpeta es una fila de índice y no una tarjeta. Lleva su
 * numeral romano, abre la carpeta desde el nombre, se pliega con un control de
 * verdad y, en el teléfono, sus operaciones salen en una hoja con nombre.
 */
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { api } from "@convex/_generated/api";
import { makeFolder, makeSystem, mid, MOCK_SYSTEM_ID } from "@/app/system-design/mock-data";
import { makeTestConvexClient, renderMobile, renderWithProviders, stubQuery } from "@/shared/testing/render";
import { FolderRow } from "./FolderRow";

const escritura = () =>
  makeTestConvexClient([stubQuery(api.systems.list, [makeSystem({ id: MOCK_SYSTEM_ID, templateType: "writing" })])]);

const obra = makeFolder({ id: mid("obra"), name: "Primera parte", subfolderCount: 1, pageCount: 3 });

describe("FolderRow", () => {
  it("numera en romano, abre desde el nombre y dice lo que contiene con el vocabulario del sistema", () => {
    renderWithProviders(<FolderRow folder={obra} systemId={MOCK_SYSTEM_ID} index={3} href="/carpeta" />, { convex: escritura() });

    expect(screen.getByText("III")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Primera parte" })).toHaveAttribute("href", "/carpeta");
    expect(screen.getByText("1 obra, 3 manuscritos")).toBeInTheDocument();
  });

  it("con hijas se pliega: el chevron dice su estado y las enseña sólo desplegada", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <FolderRow folder={obra} systemId={MOCK_SYSTEM_ID} index={1} href="#">
        <p>Capítulo uno</p>
      </FolderRow>,
      { convex: escritura() },
    );

    const chevron = screen.getByRole("button", { name: "Desplegar Primera parte" });
    expect(chevron).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Capítulo uno")).not.toBeInTheDocument();

    await user.click(chevron);
    expect(screen.getByRole("button", { name: "Plegar Primera parte" })).toHaveAttribute("aria-expanded", "true");
    expect(within(screen.getByRole("group", { name: "Primera parte" })).getByText("Capítulo uno")).toBeVisible();
  });

  it("sin hijas no ofrece plegar", () => {
    renderWithProviders(<FolderRow folder={obra} systemId={MOCK_SYSTEM_ID} index={1} href="#" />, { convex: escritura() });
    expect(screen.queryByRole("button", { name: /Desplegar/ })).not.toBeInTheDocument();
  });

  it("en el teléfono las operaciones salen en una hoja con su nombre, lo irreversible al final", async () => {
    const user = userEvent.setup();
    renderMobile(<FolderRow folder={obra} systemId={MOCK_SYSTEM_ID} index={1} href="#" />, { convex: escritura() });

    await user.click(screen.getByRole("button", { name: "Opciones de Primera parte" }));

    const hoja = screen.getByRole("group", { name: "Opciones de Primera parte" });
    const operaciones = within(hoja).getAllByRole("button").map((b) => b.textContent);
    expect(operaciones).toEqual(["Renombrar", "Eliminar"]);
  });
});
