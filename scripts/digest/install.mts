import { copyFile, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

// Engancha el diario a Claude Code, en el laptop de Elias. Es idempotente:
// correrlo dos veces no duplica nada y no pisa lo que ya haya.
//
//   bash scripts/digest/hook.sh --install
//
// Hace dos cosas, y la primera es la urgente:
//
//  1. `cleanupPeriodDays: 365`. Sin esto Claude Code borra las transcripciones
//     a los 30 días, y el diario se queda sin materia prima. Es lo primero
//     porque cada día que pasa sin ponerlo se pierde un día del pasado.
//  2. Un hook `SessionEnd` que sube el digest de la semana en curso. Corre al
//     terminar de trabajar, que es cuando hay algo nuevo que contar, así que no
//     hay nada que recordar ni ningún temporizador que vigilar.

const AJUSTES = join(homedir(), '.claude', 'settings.json');
const DIAS_DE_RETENCION = 365;
const GUION = resolve(process.cwd(), 'scripts', 'digest', 'hook.sh');

type Hook = { type: string; command: string };
type Grupo = { hooks?: Hook[] };
type Ajustes = { cleanupPeriodDays?: number; hooks?: Record<string, Grupo[]> };

if (!existsSync(AJUSTES)) {
  console.error(`No existe ${AJUSTES}. Abre Claude Code una vez y vuelve a correr esto.`);
  process.exit(1);
}

const original = await readFile(AJUSTES, 'utf8');
const ajustes = JSON.parse(original) as Ajustes;
const cambios: string[] = [];

if (ajustes.cleanupPeriodDays !== DIAS_DE_RETENCION) {
  const antes = ajustes.cleanupPeriodDays ?? 30;
  ajustes.cleanupPeriodDays = DIAS_DE_RETENCION;
  cambios.push(`cleanupPeriodDays: ${antes} → ${DIAS_DE_RETENCION}`);
}

const comando = `bash ${GUION}`;
const grupos = (ajustes.hooks ??= {}).SessionEnd ?? [];
const yaEsta = grupos.some((g) => g.hooks?.some((h) => h.command === comando));
if (!yaEsta) {
  grupos.push({ hooks: [{ type: 'command', command: comando }] });
  ajustes.hooks.SessionEnd = grupos;
  cambios.push('hook SessionEnd del diario añadido');
}

if (cambios.length === 0) {
  console.log('El diario ya estaba instalado. Nada que hacer.');
  process.exit(0);
}

// La copia va antes de escribir: es el fichero de ajustes de Elias, no del repo.
await copyFile(AJUSTES, `${AJUSTES}.antes-del-diario`);
await writeFile(AJUSTES, `${JSON.stringify(ajustes, null, 2)}\n`, 'utf8');

console.log(`Instalado. Copia de lo anterior en ${AJUSTES}.antes-del-diario`);
for (const cambio of cambios) console.log(`  · ${cambio}`);
console.log('\nFalta que `~/.config/secretos/kino.env` tenga KINO_DIGEST_URL y KINO_DIGEST_TOKEN.');
