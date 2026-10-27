/**
 * Criterio: la barra de una tabla es una barra de herramientas con nombre y
 * cada operación dice lo que hace con una palabra. Ningún botón encoge ni
 * parte su palabra en dos renglones: si la barra no cabe, se desplaza la fila
 * interior y el globo con su sombra queda entero. Tocar una operación la hace.
 */
import { useEffect } from "react";
import { describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Editor } from "@tiptap/react";
import { renderMobile } from "@/shared/testing/render";
import { EditorProvider, useSharedEditor } from "./EditorContext";
import { TableToolbar } from "./TableMenus";

const TABLA =
  "<table><tbody><tr><th><p>Quién</p></th><th><p>Dónde</p></th></tr><tr><td><p>Inés</p></td><td><p>La casa</p></td></tr></tbody></table>";

let editor: Editor | null = null;

function Barra() {
  const actual = useSharedEditor();
  useEffect(() => {
    editor = actual;
  }, [actual]);
  if (!actual) return null;
  return <TableToolbar editor={actual} />;
}

describe("TableToolbar", () => {
  it("es una barra con nombre y operaciones con palabra, que no se parten", async () => {
    renderMobile(
      <EditorProvider initialContent={TABLA}>
        <Barra />
      </EditorProvider>,
    );
    const barra = await screen.findByRole("toolbar", { name: "Tabla" });
    expect(barra).not.toHaveClass("overflow-x-auto");
    expect(barra.firstElementChild).toHaveClass("overflow-x-auto");
    for (const nombre of ["Añadir fila", "Quitar fila", "Añadir columna", "Quitar columna", "Encabezado", "Borrar la tabla"]) {
      const boton = screen.getByRole("button", { name: nombre });
      expect(boton).toHaveClass("shrink-0", "whitespace-nowrap");
    }
  });

  it("añadir fila la añade a la tabla", async () => {
    renderMobile(
      <EditorProvider initialContent={TABLA}>
        <Barra />
      </EditorProvider>,
    );
    await screen.findByRole("toolbar", { name: "Tabla" });
    editor!.commands.setTextSelection(3);
    await userEvent.click(screen.getByRole("button", { name: "Añadir fila" }));
    await waitFor(() => expect(editor!.getHTML().match(/<tr>/g)).toHaveLength(3));
  });
});
