import { homedir } from 'node:os';
import { join } from 'node:path';
import { readFile } from 'node:fs/promises';
import { bloqueaPor } from './denylist';
import { digestsPorSemana, leerTranscripciones, promptsDeTranscripcion, semanaDe, type Digest } from './extract';

// El hook del diario: lee las transcripciones de este laptop, arma el digest de
// la semana en curso y lo sube. Nada crudo viaja.
//
//   bash scripts/digest/hook.sh                    sube la semana en curso
//   bash scripts/digest/hook.sh --dry-run          la imprime y no sube nada
//   bash scripts/digest/hook.sh --dry-run <fichero> lo mismo, de una sola transcripción
//   bash scripts/digest/hook.sh --medir            cuenta el corpus entero
//   bash scripts/digest/hook.sh --relleno          sube todas las semanas que haya
//   bash scripts/digest/hook.sh --install          lo engancha al final de cada sesión
//
// Se instala como hook `SessionEnd` de Claude Code, que es lo que hace que no
// haya nada que recordar: corre cuando Elias termina de trabajar, que es
// exactamente cuando hay algo nuevo que contar. Subir la misma semana muchas
// veces es gratis: el servidor la reemplaza, nunca la duplica.

const RAIZ = process.env.KINO_TRANSCRIPCIONES ?? join(homedir(), '.claude', 'projects');
const SECRETOS = join(homedir(), '.config', 'secretos', 'kino.env');

async function secreto(nombre: string): Promise<string | undefined> {
  if (process.env[nombre]) return process.env[nombre];
  const contenido = await readFile(SECRETOS, 'utf8').catch(() => '');
  const linea = contenido.split('\n').find((l) => l.startsWith(`${nombre}=`));
  return linea?.slice(nombre.length + 1).replace(/^["']|["']$/g, '');
}

/** El aviso que el hook imprime al bloquear: el patrón, jamás el secreto. */
function revisar(digest: Digest): string | null {
  return bloqueaPor(`${digest.digest.summary}\n${digest.digest.quote}`);
}

async function subir(digest: Digest): Promise<void> {
  const url = await secreto('KINO_DIGEST_URL');
  const token = await secreto('KINO_DIGEST_TOKEN');
  if (!url || !token) {
    console.error(`Faltan KINO_DIGEST_URL o KINO_DIGEST_TOKEN en ${SECRETOS}. No se subió nada.`);
    process.exitCode = 1;
    return;
  }
  const res = await fetch(`${url}/digests`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(digest),
  });
  const cuerpo = (await res.json().catch(() => ({}))) as { created?: boolean; bytes?: number };
  if (!res.ok) {
    console.error(`El servidor rechazó el digest de ${digest.externalId}: ${res.status}`);
    process.exitCode = 1;
    return;
  }
  console.log(`${digest.externalId}: ${cuerpo.created ? 'creado' : 'actualizado'}, ${cuerpo.bytes} bytes.`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const modo = args[0];

  if (modo === '--medir') {
    const prompts = await leerTranscripciones(RAIZ);
    const digests = digestsPorSemana(prompts);
    const bytes = digests.map((d) => new TextEncoder().encode(JSON.stringify(d.digest)).length);
    const media = Math.round(bytes.reduce((a, b) => a + b, 0) / Math.max(1, bytes.length));
    console.log(`${prompts.length} frases, ${new Set(prompts.map((p) => p.sessionId)).size} sesiones, ${digests.length} semanas.`);
    console.log(`Digest por semana: media ${media} B, máximo ${Math.max(...bytes, 0)} B.`);
    const bloqueados = digests.filter((d) => revisar(d) !== null);
    console.log(`Bloqueados por la denylist: ${bloqueados.length}.`);
    return;
  }

  const seco = modo === '--dry-run';
  const relleno = modo === '--relleno';
  const fichero = seco ? args[1] : undefined;

  const prompts = fichero
    ? promptsDeTranscripcion(await readFile(fichero, 'utf8'), fichero)
    : await leerTranscripciones(RAIZ);

  const semanaActual = semanaDe(Date.now());
  const todas = digestsPorSemana(prompts);
  // El hook normal sube sólo la semana en curso, que es la única que puede
  // haber cambiado. El relleno sube las que ya estaban en el disco el día que
  // se instaló, y se corre una vez: sin él, la primera línea del lunes no
  // tendría la semana anterior que citar.
  const objetivo = fichero || relleno ? todas : todas.filter((d) => d.externalId === semanaActual);

  if (objetivo.length === 0) {
    console.log(`Nada que subir: no hay sesiones en ${semanaActual}.`);
    return;
  }

  for (const digest of objetivo) {
    const patron = revisar(digest);
    if (patron) {
      console.error(`${digest.externalId}: bloqueado por ${patron}. No se subió.`);
      process.exitCode = 1;
      continue;
    }
    if (seco) console.log(JSON.stringify(digest, null, 2));
    else await subir(digest);
  }
}

// `void` y no `await` de primer nivel: `tsx` transpila este fichero a CommonJS
// y ahí el await suelto no existe.
void main();
