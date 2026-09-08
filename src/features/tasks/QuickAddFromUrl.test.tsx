/**
 * Criterio: el atajo del icono abre el diálogo. `manifest.json` apunta a
 * `/dashboard?action=new-task` y nadie leía el parámetro: mantenías pulsado el
 * icono, elegías Nueva tarea y aterrizabas sin diálogo. Un affordance muerto en
 * la superficie más visible del móvil.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import manifest from "../../../public/manifest.json";
import { setNavigation, testRouter } from "@/shared/testing/navigation";
import { useQuickAddStore } from "./quick-add.store";
import { QuickAddFromUrl } from "./QuickAddFromUrl";

vi.mock("next/navigation", async () => (await import("@/shared/testing/navigation")).navigationMock());

beforeEach(() => {
  useQuickAddStore.getState().setOpen(false);
});

describe("QuickAddFromUrl", () => {
  it("el atajo que declara el manifiesto es el que esta pantalla lee", () => {
    const atajo = manifest.shortcuts.find((s) => s.name === "Nueva tarea")!;

    expect(atajo.url).toBe("/dashboard?action=new-task");
  });

  it("con el parámetro puesto abre el diálogo y lo quita de la URL", () => {
    setNavigation({ pathname: "/dashboard", search: "action=new-task" });

    render(<QuickAddFromUrl />);

    expect(useQuickAddStore.getState().open).toBe(true);
    expect(testRouter.replace).toHaveBeenCalledWith("/dashboard");
  });

  it("sin el parámetro no abre nada ni toca la URL", () => {
    setNavigation({ pathname: "/dashboard", search: "" });

    render(<QuickAddFromUrl />);

    expect(useQuickAddStore.getState().open).toBe(false);
    expect(testRouter.replace).not.toHaveBeenCalled();
  });

  it("conserva el resto de la URL al retirar el parámetro", () => {
    setNavigation({ pathname: "/dashboard", search: "action=new-task&tag=abc" });

    render(<QuickAddFromUrl />);

    expect(testRouter.replace).toHaveBeenCalledWith("/dashboard?tag=abc");
  });
});
