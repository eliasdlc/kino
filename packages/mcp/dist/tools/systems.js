import { z } from 'zod';
import { kinoFetch } from '../client.js';
export function registerSystemTools(server) {
    server.tool('list_systems', 'Lista todos los sistemas del usuario en Kino (proyectos, áreas, etc.)', {}, async () => {
        const systems = await kinoFetch('/api/systems');
        return { content: [{ type: 'text', text: JSON.stringify(systems, null, 2) }] };
    });
    server.tool('create_system', 'Crea un nuevo sistema (proyecto o área) en Kino', {
        name: z.string().min(1).max(100).describe('Nombre del sistema'),
        color: z
            .enum(['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'gray'])
            .optional()
            .describe('Color del sistema'),
        icon: z.string().optional().describe('Emoji o ícono para el sistema'),
    }, async ({ name, color, icon }) => {
        const system = await kinoFetch('/api/systems', {
            method: 'POST',
            body: JSON.stringify({ name, color, icon }),
        });
        return { content: [{ type: 'text', text: JSON.stringify(system, null, 2) }] };
    });
}
