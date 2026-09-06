/**
 * El presupuesto de JavaScript que se le manda al navegador.
 *
 * Se mide sobre `.next/`, así que exige un `pnpm build` antes. Dos cifras:
 *
 *   compartido  lo que carga *toda* ruta antes de pintar nada. Es el que
 *               importa: crece cuando alguien mete una librería en un layout.
 *   total       todos los chunks de cliente. Sube cuando entra una dependencia
 *               nueva aunque sólo la use una pantalla.
 *
 * No hay presupuesto por ruta y no es un olvido: Next 16 dejó de imprimir el
 * "First Load JS" por ruta, y derivarlo del manifiesto del App Router significa
 * leer ficheros internos que cambian en cada minor. Cuando vuelva a publicarse,
 * este script gana la tercera cifra sin cambiar de forma.
 *
 *   node scripts/check-bundle.mjs
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

// Fijados por la primera medición, sobre `dev` con Next 16. Subirlos es una
// decisión que se escribe en el PR, no un ajuste: cada KB aquí lo paga el
// teléfono de quien abre la app en datos móviles.
const PRESUPUESTO_KB = {
  compartido: 830,
  total: 4700,
};

const RAIZ = ".next";

function jsBytes(dir) {
  let total = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const ruta = join(dir, entry.name);
    if (entry.isDirectory()) total += jsBytes(ruta);
    else if (entry.name.endsWith(".js")) total += statSync(ruta).size;
  }
  return total;
}

const manifest = JSON.parse(readFileSync(join(RAIZ, "build-manifest.json"), "utf8"));
const compartido = [...manifest.rootMainFiles, ...manifest.polyfillFiles]
  .reduce((suma, fichero) => suma + statSync(join(RAIZ, fichero)).size, 0);

const medido = {
  compartido: Math.round(compartido / 1024),
  total: Math.round(jsBytes(join(RAIZ, "static", "chunks")) / 1024),
};

let excedido = false;
for (const [clave, tope] of Object.entries(PRESUPUESTO_KB)) {
  const kb = medido[clave];
  const veredicto = kb > tope ? `PASA EL TOPE por ${kb - tope} KB` : `ok, ${tope - kb} KB de margen`;
  console.log(`${clave.padEnd(12)} ${String(kb).padStart(5)} KB / ${tope} KB   ${veredicto}`);
  if (kb > tope) excedido = true;
}

if (excedido) {
  console.error("\ncheck-bundle: el JavaScript del cliente pasó su presupuesto.");
  process.exit(1);
}
console.log("\ncheck-bundle: dentro del presupuesto");
