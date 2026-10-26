/**
 * Criterio: escritura abre en sus manuscritos y su pestaña va primero; el
 * resto abre donde diga su composición. La URL manda sobre la entrada.
 */
import { describe, expect, it } from "vitest";
import { surfaceOf, systemLanding, systemSurfaces } from "./system-surfaces";

describe("system-surfaces", () => {
  it("escritura abre en documentos; un académico, en tareas", () => {
    expect(systemLanding({ templateType: "writing" })).toBe("docs");
    expect(systemLanding({ templateType: "academic" })).toBe("tasks");
  });

  it("la pestaña de entrada va primero", () => {
    expect(systemSurfaces("docs")).toEqual(["docs", "tasks"]);
    expect(systemSurfaces("tasks")).toEqual(["tasks", "docs"]);
  });

  it("la URL manda sobre la entrada, y un valor desconocido cae a ella", () => {
    expect(surfaceOf("tasks", "docs")).toBe("tasks");
    expect(surfaceOf("cualquiera", "docs")).toBe("docs");
  });
});
