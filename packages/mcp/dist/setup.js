import { createServer } from 'http';
import { exec } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
const BASE_URL = process.env.KINO_BASE_URL ?? 'https://usekino.dev';
const TIMEOUT_MS = 5 * 60 * 1000;
function openBrowser(url) {
    const platform = process.platform;
    const cmd = platform === 'darwin' ? `open "${url}"` :
        platform === 'win32' ? `start "" "${url}"` :
            `xdg-open "${url}"`;
    exec(cmd);
}
function mergeClaudeJson(token) {
    const claudeJsonPath = join(homedir(), '.claude.json');
    let existing = {};
    try {
        existing = JSON.parse(readFileSync(claudeJsonPath, 'utf-8'));
    }
    catch {
        // file doesn't exist or is invalid JSON — start fresh
    }
    const mcpServers = existing.mcpServers ?? {};
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
         justify-content: center; min-height: 100vh; margin: 0; background: #f9fafb; }
  .card { background: white; border-radius: 12px; padding: 40px 48px;
          box-shadow: 0 4px 24px rgba(0,0,0,.08); text-align: center; max-width: 400px; }
  h1 { margin: 0 0 8px; font-size: 1.5rem; }
  p { margin: 0; color: #6b7280; }
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
    const port = await new Promise((resolve, reject) => {
        server.listen(0, '127.0.0.1', () => {
            const addr = server.address();
            if (!addr || typeof addr === 'string')
                return reject(new Error('Failed to bind server'));
            resolve(addr.port);
        });
    });
    const authUrl = `${BASE_URL}/api/connect/cli?port=${port}`;
    console.log(`\nOpening browser for authentication...`);
    console.log(`If the browser does not open, visit:\n  ${authUrl}\n`);
    openBrowser(authUrl);
    const token = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            server.close();
            reject(new Error('Timed out waiting for authentication (5 minutes)'));
        }, TIMEOUT_MS);
        server.on('request', (req, res) => {
            const url = new URL(req.url ?? '/', `http://localhost:${port}`);
            if (url.pathname !== '/callback') {
                res.writeHead(404).end();
                return;
            }
            const token = url.searchParams.get('token');
            if (!token) {
                res.writeHead(400).end('Missing token');
                return;
            }
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(SUCCESS_HTML);
            clearTimeout(timer);
            server.close();
            resolve(token);
        });
    });
    const configPath = mergeClaudeJson(token);
    console.log(`✓ ~/.claude.json updated (${configPath})`);
    console.log(`✓ Restart Claude Code to activate Kino tools.\n`);
}
