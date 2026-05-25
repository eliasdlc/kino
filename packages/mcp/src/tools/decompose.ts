import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import Anthropic from '@anthropic-ai/sdk';
import { kinoFetch } from '../client.js';

const ENERGY_KEYWORDS: Record<string, string[]> = {
  high: [
    'analiz', 'design', 'diseñ', 'archi', 'investig', 'research', 'develop', 'desarroll',
    'implement', 'creat', 'present', 'escribir', 'write', 'revis', 'audit', 'plan',
  ],
  low: [
    'archiv', 'mover', 'move', 'elimin', 'delet', 'copiar', 'copy', 'renombr', 'rename',
    'respond', 'reply', 'confirm', 'schedule', 'agendar', 'recordar', 'remind',
  ],
};

const TIME_KEYWORDS: Record<string, number> = {
  rápido: 15, quick: 15, pequeño: 15, small: 15,
  reunión: 60, meeting: 60, review: 45, revisión: 45,
  analiz: 90, research: 90, investigar: 90,
  present: 60, deploy: 30,
};

function estimateEnergy(text: string): 'high' | 'medium' | 'low' {
  const lower = text.toLowerCase();
  for (const kw of ENERGY_KEYWORDS.high) {
    if (lower.includes(kw)) return 'high';
  }
  for (const kw of ENERGY_KEYWORDS.low) {
    if (lower.includes(kw)) return 'low';
  }
  return 'medium';
}

function estimateTime(text: string): string {
  const lower = text.toLowerCase();
  for (const [kw, minutes] of Object.entries(TIME_KEYWORDS)) {
    if (lower.includes(kw)) {
      const h = Math.floor(minutes / 60).toString().padStart(2, '0');
      const m = (minutes % 60).toString().padStart(2, '0');
      return `${h}:${m}:00`;
    }
  }
  return '00:30:00';
}

type Task = {
  id: string;
  title: string;
  description?: string | null;
  systemId: string;
  energyLevel?: string | null;
};

export function registerDecomposeTools(server: McpServer) {
  server.tool(
    'estimate_task',
    'Estimates the energy level and time required for a task based on keyword analysis of its title and description.',
    {
      title: z.string().min(1).max(500).describe('Task title'),
      description: z.string().optional().describe('Task description for more accurate estimation'),
    },
    async ({ title, description }) => {
      const text = [title, description ?? ''].join(' ');
      const energyLevel = estimateEnergy(text);
      const estimatedTime = estimateTime(text);
      const result = {
        energyLevel,
        estimatedTime,
        reasoning: `Basado en keywords: "${energyLevel === 'high' ? 'análisis/diseño/investigación' : energyLevel === 'low' ? 'acción mecánica' : 'trabajo estándar'}"`,
      };
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'reorder_by_importance',
    'Returns today\'s tasks sorted by importance score (priority × urgency × age). Use to decide what to tackle first.',
    {},
    async () => {
      const suggestions = await kinoFetch('/api/insights/suggest?limit=10');
      return { content: [{ type: 'text', text: JSON.stringify(suggestions, null, 2) }] };
    },
  );

  server.tool(
    'generate_subtasks',
    'Uses AI to suggest subtasks for decomposing a complex task into smaller, actionable steps. Requires ANTHROPIC_API_KEY env var.',
    {
      taskId: z.string().uuid().describe('UUID of the task to decompose'),
      count: z
        .number()
        .int()
        .min(2)
        .max(8)
        .optional()
        .describe('Number of subtasks to generate (default: 3)'),
    },
    async ({ taskId, count = 3 }) => {
      if (!process.env.ANTHROPIC_API_KEY) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ error: 'ANTHROPIC_API_KEY not set. Cannot generate subtasks.' }),
          }],
        };
      }

      const tasks = await kinoFetch<Task[]>(`/api/tasks?status=today`);
      const task = Array.isArray(tasks) ? tasks.find((t) => t.id === taskId) : null;

      if (!task) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ error: `Task ${taskId} not found in active tasks.` }),
          }],
        };
      }

      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

      const prompt = `You are a productivity assistant. Decompose the following task into ${count} concrete, actionable subtasks.

Task: "${task.title}"
${task.description ? `Description: ${task.description}` : ''}

Return ONLY a JSON array of objects with this shape (no markdown, no explanation):
[
  { "title": "...", "energyLevel": "high|medium|low", "estimatedMinutes": 30 },
  ...
]`;

      const message = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 512,
        messages: [{ role: 'user', content: prompt }],
      });

      const rawText = message.content[0]?.type === 'text' ? message.content[0].text : '[]';

      let subtasks: unknown[] = [];
      try {
        subtasks = JSON.parse(rawText);
      } catch {
        subtasks = [];
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            parentTaskId: taskId,
            parentTitle: task.title,
            systemId: task.systemId,
            subtasks,
            note: 'Use bulk_create_tasks to create these as subtasks (set parentTaskId).',
          }, null, 2),
        }],
      };
    },
  );
}
