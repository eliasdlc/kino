import { z } from 'zod';
export function registerAnalyzeTools(server, kinoFetch) {
    server.tool('detect_patterns', 'Analyzes recent behavior and returns the most urgent productivity pattern detected (overload, abandonment, disorganization, or underuse) along with a suggested corrective action.', {}, async () => {
        const pattern = await kinoFetch('/api/insights/patterns');
        return { content: [{ type: 'text', text: JSON.stringify(pattern, null, 2) }] };
    });
    server.tool('get_energy_distribution', 'Returns how much cognitive energy the user has spent per system over the last N days. Useful to detect imbalances (e.g. one system consuming 80% of energy).', {
        days: z
            .number()
            .int()
            .min(1)
            .max(90)
            .optional()
            .describe('Number of days to analyze (default: 7)'),
    }, async ({ days }) => {
        const params = days ? `?days=${days}` : '';
        const distribution = await kinoFetch(`/api/insights/energy-distribution${params}`);
        return { content: [{ type: 'text', text: JSON.stringify(distribution, null, 2) }] };
    });
    server.tool('find_stale_systems', 'Returns systems with no activity (no task completed and no time logged) in the last N days. Helps identify abandoned projects or areas.', {
        days: z
            .number()
            .int()
            .min(1)
            .max(180)
            .optional()
            .describe('Inactivity threshold in days (default: 14)'),
    }, async ({ days }) => {
        const params = days ? `?days=${days}` : '';
        const stale = await kinoFetch(`/api/insights/stale-systems${params}`);
        return { content: [{ type: 'text', text: JSON.stringify(stale, null, 2) }] };
    });
}
