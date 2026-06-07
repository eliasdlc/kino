import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { kinoFetch } from '../client.js';

export function registerEnergyTools(server: McpServer) {
  server.tool(
    'get_energy_checkin',
    'Obtiene el check-in de energía del usuario para hoy (nivel actual y calidad de sueño), si ya lo registró.',
    {},
    async () => {
      const checkin = await kinoFetch('/api/energy/checkin');
      return { content: [{ type: 'text', text: JSON.stringify(checkin, null, 2) }] };
    },
  );

  server.tool(
    'create_energy_checkin',
    'Registra el check-in de energía del usuario para hoy. currentLevel es 1-100 y sleepQuality es good/partial/poor.',
    {
      currentLevel: z
        .number()
        .int()
        .min(1)
        .max(100)
        .describe('Nivel de energía actual de 1 a 100'),
      sleepQuality: z
        .enum(['good', 'partial', 'poor'])
        .describe('Calidad del sueño: good (bueno), partial (parcial), poor (malo)'),
    },
    async (data) => {
      const checkin = await kinoFetch('/api/energy/checkin', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      return { content: [{ type: 'text', text: JSON.stringify(checkin, null, 2) }] };
    },
  );

  server.tool(
    'get_today_plan',
    'Obtiene el plan de energía de hoy: tareas recomendadas ajustadas al nivel de energía y límite diario del usuario.',
    {},
    async () => {
      const plan = await kinoFetch('/api/energy/plan/today');
      return { content: [{ type: 'text', text: JSON.stringify(plan, null, 2) }] };
    },
  );
}
