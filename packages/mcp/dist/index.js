import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerSystemTools } from './tools/systems.js';
import { registerTaskTools } from './tools/tasks.js';
import { registerPageTools } from './tools/pages.js';
if (!process.env.KINO_API_KEY) {
    console.error('Error: KINO_API_KEY environment variable is required');
    process.exit(1);
}
const server = new McpServer({
    name: 'kino',
    version: '1.0.0',
});
registerSystemTools(server);
registerTaskTools(server);
registerPageTools(server);
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main();
