/**
 * Mide lo que el presupuesto de rendimiento vigila en cada PR y en cada push a
 * `dev`, y lo escribe como JSON para `bin/budget.py` del repo agents.
 *
 *   pnpm build && node scripts/medir-presupuesto.mjs [--salida perf/results.json]
 *
 * Solo bytes del build y conteos: salen iguales para el mismo commit. No hay
 * Lighthouse porque `next start` responde 500 sin la clave de Clerk, y esa
 * clave no entra al CI por una métrica de laboratorio.
 *
 * `compartido` y `total` se cuentan igual que `check-bundle.mjs`, fuera el
 * catálogo visual, para que la tabla del PR y el check digan la misma cifra.
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const args = process.argv.slice(2);
const salida = args.includes("--salida") ? args[args.indexOf("--salida") + 1] : "perf/results.json";
const RAIZ = ".next";
const FUERA_DEL_TOTAL = new Set([join(RAIZ, "static", "chunks", "app", "system-design")]);

const kb = (bytes) => Math.round(bytes / 1024);

function archivos(dir, prueba) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const ruta = join(dir, e.name);
    if (FUERA_DEL_TOTAL.has(ruta)) return [];
    return e.isDirectory() ? archivos(ruta, prueba) : prueba(e.name) ? [ruta] : [];
  });
}
const peso = (rutas) => rutas.reduce((suma, r) => suma + statSync(r).size, 0);

if (!existsSync(join(RAIZ, "build-manifest.json"))) {
  console.error("medir-presupuesto: no hay build. Corre `pnpm build` antes.");
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(join(RAIZ, "build-manifest.json"), "utf8"));
const compartido = [...manifest.rootMainFiles, ...manifest.polyfillFiles].map((f) => join(RAIZ, f));
const paquete = JSON.parse(readFileSync("package.json", "utf8"));

function problemasDeLint() {
  let salidaLint;
  try {
    salidaLint = execFileSync("pnpm", ["exec", "eslint", ".", "--format", "json"], { encoding: "utf8", maxBuffer: 64 << 20 });
  } catch (e) {
    // eslint sale con 1 cuando hay errores; el JSON sigue en stdout.
    salidaLint = e.stdout;
  }
  return salidaLint ? JSON.parse(salidaLint).reduce((s, f) => s + f.errorCount + f.warningCount, 0) : undefined;
}

const metricas = [
  { id: "shared_js_kb", label: "Shared JS", unit: "KB", rule: "blocks", value: kb(peso(compartido)) },
  { id: "total_js_kb", label: "Total client JS", unit: "KB", rule: "blocks",
    value: kb(peso(archivos(join(RAIZ, "static", "chunks"), (n) => n.endsWith(".js")))) },
  { id: "css_kb", label: "CSS", unit: "KB", rule: "blocks", value: kb(peso(archivos(join(RAIZ, "static"), (n) => n.endsWith(".css")))) },
  { id: "font_kb", label: "Fonts", unit: "KB", rule: "blocks",
    value: kb(peso([...archivos(join(RAIZ, "static", "media"), (n) => /\.(woff2?|ttf|otf)$/.test(n)),
                    ...archivos("public", (n) => /\.(woff2?|ttf|otf)$/.test(n))])) },
  { id: "packages", label: "npm packages", unit: "", rule: "shows",
    set: Object.keys({ ...paquete.dependencies, ...paquete.devDependencies }).sort() },
];
const lint = problemasDeLint();
if (lint !== undefined) metricas.push({ id: "lint_issues", label: "ESLint issues", unit: "", rule: "warns", worse: "higher", band_abs: 0, value: lint });
if (process.env.BUILD_SECONDS) metricas.push({ id: "build_s", label: "Build time", unit: "s", rule: "shows", value: Number(process.env.BUILD_SECONDS) });

// En un PR, GITHUB_SHA es el merge temporal de GitHub; HEAD_SHA es el commit del PR.
const sha = process.env.HEAD_SHA ?? process.env.GITHUB_SHA ?? execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
mkdirSync(dirname(salida), { recursive: true });
writeFileSync(salida, JSON.stringify({ schema: 1, sha, ceilings: JSON.parse(readFileSync("perf/budget.json", "utf8")), metrics: metricas }, null, 2));
for (const m of metricas) console.log(`${m.label.padEnd(18)} ${m.set ? `${m.set.length} packages` : `${m.value} ${m.unit}`}`);
