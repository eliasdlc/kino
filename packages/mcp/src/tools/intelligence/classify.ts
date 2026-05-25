import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { kinoFetch } from '../../client.js';

export function registerClassifyTools(server: McpServer) {
  server.tool(
    'classify_task',
    'Suggests the best system and priority for a task based on its title and description. Uses keyword matching against the user\'s systems. Confidence can be "high", "medium", or "low".',
    {
      title: z.string().min(1).max(500).describe('Task title to classify'),
      description: z.string().optional().describe('Optional task description for better accuracy'),
    },
    async ({ title, description }) => {
      const result = await kinoFetch('/api/insights/classify', {
        method: 'POST',
        body: JSON.stringify({ title, description }),
      });
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  );
}
