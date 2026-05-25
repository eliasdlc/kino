import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { kinoFetch } from '../../client.js';

export function registerSuggestTools(server: McpServer) {
  server.tool(
    'suggest_next_action',
    'Returns the top N tasks the user should work on next, ranked by importance score (priority + urgency + age). Optionally filter by energy level to match current capacity.',
    {
      energyLevel: z
        .enum(['high', 'medium', 'low'])
        .optional()
        .describe('Filter by the energy level you can currently handle'),
      limit: z
        .number()
        .int()
        .min(1)
        .max(10)
        .optional()
        .describe('Number of suggestions to return (default: 3)'),
    },
    async ({ energyLevel, limit }) => {
      const params = new URLSearchParams();
      if (energyLevel) params.set('energyLevel', energyLevel);
      if (limit) params.set('limit', String(limit));
      const suggestions = await kinoFetch(`/api/insights/suggest?${params.toString()}`);
      return { content: [{ type: 'text', text: JSON.stringify(suggestions, null, 2) }] };
    },
  );
}
