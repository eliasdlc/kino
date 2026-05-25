import { kinoFetch } from '../../client.js';
export function registerContextTools(server) {
    server.tool('get_user_context', 'Returns a full snapshot of the user\'s Kino state: systems, today\'s tasks, current energy level, and the top behavioral pattern detected. Use this as a first call before reasoning about tasks.', {}, async () => {
        const context = await kinoFetch('/api/insights/context');
        return { content: [{ type: 'text', text: JSON.stringify(context, null, 2) }] };
    });
}
