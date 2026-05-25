import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerTaskCrudTools } from './tools/crud/tasks-crud.js';
import { registerSystemCrudTools } from './tools/crud/systems-crud.js';
import { registerPageCrudTools } from './tools/crud/pages-crud.js';
import { registerContextTools } from './tools/intelligence/context.js';
import { registerAnalyzeTools } from './tools/intelligence/analyze.js';
import { registerSuggestTools } from './tools/intelligence/suggest.js';
import { registerClassifyTools } from './tools/intelligence/classify.js';
import { registerDecomposeTools } from './tools/decompose.js';
if (!process.env.KINO_API_KEY) {
    console.error('Error: KINO_API_KEY environment variable is required');
    process.exit(1);
}
const server = new McpServer({
    name: 'kino',
    version: '2.0.0',
});
// ── CRUD (raw operations) ──────────────────────────────────────────────────
registerTaskCrudTools(server);
registerSystemCrudTools(server);
registerPageCrudTools(server);
// ── Intelligence (context-aware reasoning) ─────────────────────────────────
registerContextTools(server);
registerAnalyzeTools(server);
registerSuggestTools(server);
registerClassifyTools(server);
// ── Decompose (AI-assisted task breakdown) ─────────────────────────────────
registerDecomposeTools(server);
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main();
