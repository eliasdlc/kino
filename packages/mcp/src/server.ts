import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { createKinoFetch } from './client.js';
import { registerAllKinoTools } from './tools/register-all.js';

export async function startServer() {
  if (!process.env.KINO_API_KEY) {
    console.error('Error: KINO_API_KEY environment variable is required');
    process.exit(1);
  }

  const server = new McpServer({
    name: 'kino',
    version: '2.4.0',
  });

  const kinoFetch = createKinoFetch({
    baseUrl: process.env.KINO_BASE_URL ?? 'https://www.usekino.dev',
    token: process.env.KINO_API_KEY,
  });

  registerAllKinoTools(server, kinoFetch);

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
