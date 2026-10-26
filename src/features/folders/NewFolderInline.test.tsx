/**
 * Criterio: crear una obra (o una clase, un milestone) es una acción con
 * nombre que abre una hoja con campos de 48 px, uno por campo del manifiesto,
 * y no un mini formulario en línea. Sin nombre no se crea nada.
 */
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { api } from "@convex/_generated/api";
import { makeFolder, mid } from "@/app/system-design/mock-data";
import { makeTestConvexClient, renderMobile, stubMutation } from "@/shared/testing/render";
import { SYSTEM_TYPE_CONFIG } from "@/shared/lib/system-types";
import { NewFolderInline } from "./NewFolderInline";

const obra = SYSTEM_TYPE_CONFIG.writing.folderRole!;

function montar() {
  const convex = makeTestConvexClient([], [stubMutation(api.folders.create, makeFolder({ id: mid("nueva") }))]);
  renderMobile(
    <NewFolderInline systemId={mid("sys")} label={obra.newLabel} placeholder={obra.placeholder} fields={obra.fields} />,
    { convex },
  );
  return convex;
}

describe("NewFolderInline", () => {
  it("abre una hoja titulada con la acción, con un campo por campo visible del manifiesto", async () => {
    const user = userEvent.setup();
    montar();
    await user.click(screen.getByRole("button", { name: obra.newLabel }));

    expect(screen.getByRole("heading", { name: obra.newLabel })).toBeInTheDocument();
    expect(screen.getByLabelText("Nombre")).toBeInTheDocument();
    for (const field of obra.fields.filter((f) => !f.hidden)) {
      expect(screen.getByLabelText(field.label)).toBeInTheDocument();
    }
  });

  it("sin nombre no se puede crear; con nombre crea con su metadata", async () => {
    const user = userEvent.setup();
    const convex = montar();
    await user.click(screen.getByRole("button", { name: obra.newLabel }));

    expect(screen.getByRole("button", { name: "Crear" })).toBeDisabled();
    await user.type(screen.getByLabelText("Nombre"), "Segunda parte");
    await user.type(screen.getByLabelText("Meta de palabras"), "50000");
    await user.click(screen.getByRole("button", { name: "Crear" }));

    expect(convex.calls.at(-1)).toMatchObject({
      kind: "mutation",
      name: "folders:create",
      args: expect.objectContaining({ name: "Segunda parte", metadata: { wordGoal: "50000" } }),
    });
  });
});
