import { describe, expect, it } from "vitest";
import { PROVEEDORES_VIVOS } from "../../../convex/connections";
import { PROVEEDORES, enPantalla, proveedor } from "./providers";

describe("el registro de fuentes", () => {
  it("sólo GitHub y el aula virtual escriben tareas: una tercera necesita decisión escrita", () => {
    const escribenTareas = PROVEEDORES.filter((p) => p.entrega === "tarea").map((p) => p.id);

    expect(escribenTareas.sort()).toEqual(["github", "pva"]);
  });

  it("toda fuente que entrega capturas declara qué clase de captura produce", () => {
    for (const p of PROVEEDORES.filter((p) => p.entrega === "captura")) {
      expect(p.clase, p.id).toBeDefined();
    }
  });

  it("las conexiones OAuth vivas son las mismas que el servidor acepta", () => {
    const vivasOAuth = PROVEEDORES.filter((p) => p.estado === "live" && p.refresco === "oauth_poll").map((p) => p.id);

    expect(vivasOAuth).toEqual([...PROVEEDORES_VIVOS]);
  });

  it("ninguna fuente que no responde llega a la pantalla", () => {
    for (const p of PROVEEDORES) {
      expect(enPantalla(p.id), p.id).toBe(p.estado === "live");
    }
    expect(enPantalla("jira")).toBe(false);
  });

  it("los ids no se repiten", () => {
    const ids = PROVEEDORES.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(proveedor("correo")?.entrega).toBe("captura");
  });
});
