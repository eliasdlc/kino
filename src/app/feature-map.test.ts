import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * `feature-map.json` es el vocabulario de la app para agentes y para quien la
 * mira: cada función que un usuario alcanza tiene una entrada con su nombre
 * en la interfaz, su ruta, cómo se llega y qué prueba que funciona. Este test
 * evita que el mapa se pudra: una página nueva sin entrada, o una entrada con
 * una ruta que ya no existe, rompen el build.
 */

const RAIZ = path.resolve(__dirname, "../..");
const APP = path.join(RAIZ, "src/app");

interface Entrada {
  id: string;
  name: string;
  route: string;
  reach: string;
  proves: string;
}

const mapa = JSON.parse(readFileSync(path.join(RAIZ, "feature-map.json"), "utf8")) as { app: string; features: Entrada[] };

/**
 * Páginas que no son una función de la app, con su motivo. Agregar una ruta
 * aquí es decir que ningún usuario con sesión la alcanza como función.
 */
const NO_SON_FUNCIONES: Record<string, string> = {
  "/": "Landing de marketing, previa a la app.",
  "/docs": "Documentación pública de marketing.",
  "/para/[segmento]": "Landings por segmento, de marketing.",
  "/system-design": "Catálogo interno de la UI para quien desarrolla, no es una función de usuario.",
};

/** Las rutas de cada `page.tsx` bajo `src/app`, sin grupos `(x)` y sin el catch-all opcional de Clerk. */
function rutasDePaginas(dir = APP, prefijo: string[] = []): string[] {
  const rutas: string[] = [];
  for (const nombre of readdirSync(dir)) {
    const completo = path.join(dir, nombre);
    if (statSync(completo).isDirectory()) {
      if (nombre === "api") continue; // Route handlers: no son páginas.
      const esGrupo = /^\(.+\)$/.test(nombre);
      const esCatchAll = /^\[\[\.\.\..+\]\]$/.test(nombre);
      rutas.push(...rutasDePaginas(completo, esGrupo || esCatchAll ? prefijo : [...prefijo, nombre]));
    } else if (nombre === "page.tsx") {
      rutas.push("/" + prefijo.join("/"));
    }
  }
  return rutas;
}

const paginas = rutasDePaginas();
const AYUDA = "add or update its entry in feature-map.json";

describe("feature-map.json", () => {
  it("cada campo es un texto no vacío", () => {
    expect(mapa.app).toBe("kino");
    expect(mapa.features.length).toBeGreaterThan(0);
    for (const f of mapa.features) {
      for (const campo of ["id", "name", "route", "reach", "proves"] as const) {
        const valor: unknown = f[campo];
        expect(typeof valor === "string" && valor.trim().length > 0, `${f.id ?? "(sin id)"}: "${campo}" must be a non-empty string`).toBe(true);
      }
    }
  });

  it("los ids son únicos y tienen la forma area.funcion", () => {
    const vistos = new Set<string>();
    for (const f of mapa.features) {
      expect(f.id, `id "${f.id}" must look like <area>.<feature>`).toMatch(/^[a-z0-9-]+\.[a-z0-9-]+$/);
      expect(vistos.has(f.id), `duplicate id "${f.id}"`).toBe(false);
      vistos.add(f.id);
    }
  });

  it("cada ruta del mapa existe como page.tsx", () => {
    for (const f of mapa.features) {
      expect(paginas, `Route ${f.route} (entry ${f.id}) has no page.tsx under src/app: ${AYUDA}`).toContain(f.route);
    }
  });

  it("cada page.tsx tiene una entrada o está en la lista de exclusiones", () => {
    const cubiertas = new Set(mapa.features.map((f) => f.route));
    for (const ruta of paginas) {
      if (ruta in NO_SON_FUNCIONES) continue;
      expect(cubiertas.has(ruta), `Route ${ruta} has a page.tsx but no feature: ${AYUDA}`).toBe(true);
    }
  });

  it("las exclusiones apuntan a páginas que existen", () => {
    for (const ruta of Object.keys(NO_SON_FUNCIONES)) {
      expect(paginas, `Excluded route ${ruta} no longer exists: remove it from NO_SON_FUNCIONES`).toContain(ruta);
    }
  });

  it("si proves nombra un archivo de test, ese archivo existe", () => {
    for (const f of mapa.features) {
      if (/^src\/\S+\.test\.tsx?$/.test(f.proves)) {
        expect(existsSync(path.join(RAIZ, f.proves)), `Entry ${f.id} (route ${f.route}) proves with ${f.proves}, which does not exist: ${AYUDA}`).toBe(true);
      }
    }
  });
});
