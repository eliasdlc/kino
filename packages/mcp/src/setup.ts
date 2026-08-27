import { createServer } from 'http';
import { spawn } from 'child_process';
import { randomBytes, timingSafeEqual } from 'crypto';
import { readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const BASE_URL = process.env.KINO_BASE_URL ?? 'https://www.usekino.dev';
const TIMEOUT_MS = 5 * 60 * 1000;

/**
 * Abre el navegador sin pasar por un shell.
 *
 * La URL se arma con `KINO_BASE_URL`, que es una variable de entorno: pasarla
 * dentro de una cadena que interpreta el shell convierte unas comillas y un
 * punto y coma en ejecución de comandos. Con `spawn` y argumentos sueltos, la
 * URL es un argumento y nada más.
 *
 * En Windows se evita `cmd /c start` a propósito: `cmd` vuelve a parsear la
 * línea que recibe, así que un `&` en la URL seguiría separando comandos.
 * `rundll32` no parsea nada.
 */
function openBrowser(url: string) {
  const [command, args] =
    process.platform === 'darwin' ? ['open', [url]] :
      process.platform === 'win32' ? ['rundll32', ['url.dll,FileProtocolHandler', url]] :
        ['xdg-open', [url]];

  const child = spawn(command, args, { detached: true, stdio: 'ignore' });
  // Que no falle el setup entero porque la máquina no tenga navegador: la URL ya
  // se imprimió y se puede abrir a mano.
  child.on('error', () => {});
  child.unref();
}

/**
 * Compara sin filtrar por tiempo cuánto coincide. Aquí el margen es teórico —el
 * atacante tendría que acertar además el puerto efímero— pero comparar nonces
 * con `===` es la clase de atajo que después se copia a un sitio donde sí pesa.
 */
function sameState(expected: string, received: string | null): boolean {
  if (!received) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(received);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Qué hacer con una petición que llega al servidor efímero del setup. */
export type CallbackOutcome =
  | { kind: 'ignored' }
  | { kind: 'rejected'; status: number; reason: string }
  | { kind: 'accepted'; token: string };

/**
 * Decide si una petición al servidor local trae de verdad el token que este
 * setup pidió.
 *
 * Está separada del servidor para poder probarla: la garantía del ticket es que
 * un `state` que no cuadra no escribe nada en la configuración, y eso se
 * comprueba viendo que sólo `accepted` lleva token. Lo demás es plomería.
 */
export function readCallback(
  requestUrl: string | undefined,
  port: number,
  expectedState: string,
): CallbackOutcome {
  const url = new URL(requestUrl ?? '/', `http://localhost:${port}`);
  if (url.pathname !== '/callback') return { kind: 'ignored' };

  if (!sameState(expectedState, url.searchParams.get('state'))) {
    return {
      kind: 'rejected',
      status: 403,
      reason: 'Rejected: the callback did not carry the expected state.',
    };
  }

  const token = url.searchParams.get('token');
  if (!token) {
    return { kind: 'rejected', status: 400, reason: 'Rejected: the callback carried no token.' };
  }

  return { kind: 'accepted', token };
}

function mergeClaudeJson(token: string) {
  const claudeJsonPath = join(homedir(), '.claude.json');

  let existing: Record<string, unknown> = {};
  try {
    existing = JSON.parse(readFileSync(claudeJsonPath, 'utf-8'));
  } catch {
    // file doesn't exist or is invalid JSON — start fresh
  }

  const mcpServers = (existing.mcpServers as Record<string, unknown>) ?? {};
  mcpServers.kino = {
    command: 'npx',
    args: ['-y', '@kino-app/mcp'],
    env: {
      KINO_API_KEY: token,
      KINO_BASE_URL: BASE_URL,
    },
  };
  existing.mcpServers = mcpServers;

  writeFileSync(claudeJsonPath, JSON.stringify(existing, null, 2) + '\n', 'utf-8');
  return claudeJsonPath;
}

const SUCCESS_HTML = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>Kino connected</title>
<style>
  body { font-family: system-ui, sans-serif; display: flex; align-items: center;
         justify-content: center; min-height: 100vh; margin: 0; background: #1c1c1c; }
  .card { background: black; border-radius: 12px; padding: 40px 48px;
          box-shadow: 0 4px 24px rgba(0,0,0,.08); text-align: center; max-width: 400px; }
  h1 { margin: 0 0 8px; font-size: 1.5rem; color: ffffff; }
  p { margin: 0; color: #1f1f1f; }
</style>
</head>
<body>
  <div class="card">
    <h1>Kino connected</h1>
    <p>You can close this tab. Restart Claude Code to activate Kino tools.</p>
  </div>
</body>
</html>`;

export async function runSetup() {
  const server = createServer();

  const port: number = await new Promise((resolve, reject) => {
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (!addr || typeof addr === 'string') return reject(new Error('Failed to bind server'));
      resolve(addr.port);
    });
  });

  // Nonce de un solo uso. Sin él, cualquier página que acierte el puerto efímero
  // puede llamar a `/callback` con su propio token y dejar tu agente escribiendo
  // en la cuenta de otro. La app lo devuelve tal cual en el redirect.
  const state = randomBytes(32).toString('base64url');

  const authUrl = new URL('/api/connect/cli', BASE_URL);
  authUrl.searchParams.set('port', String(port));
  authUrl.searchParams.set('state', state);

  console.log(`\nOpening browser for authentication...`);
  console.log(`If the browser does not open, visit:\n  ${authUrl}\n`);
  openBrowser(authUrl.toString());

  const token: string = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      server.close();
      reject(new Error('Timed out waiting for authentication (5 minutes)'));
    }, TIMEOUT_MS);

    const done = () => {
      clearTimeout(timer);
      server.close();
    };

    server.on('request', (req, res) => {
      const outcome = readCallback(req.url, port, state);

      switch (outcome.kind) {
        case 'ignored':
          res.writeHead(404).end();
          return;

        case 'rejected':
          // Se corta el flujo entero, no sólo esta petición: `mergeClaudeJson`
          // vive después del `await` y nunca llega a correr.
          res
            .writeHead(outcome.status, { 'Content-Type': 'text/plain; charset=utf-8' })
            .end(outcome.reason);
          done();
          reject(new Error(outcome.reason));
          return;

        case 'accepted':
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(SUCCESS_HTML);
          done();
          resolve(outcome.token);
      }
    });
  });

  const configPath = mergeClaudeJson(token);
  console.log(`✓ ~/.claude.json updated (${configPath})`);
  console.log(`✓ Restart Claude Code to activate Kino tools.\n`);
}
