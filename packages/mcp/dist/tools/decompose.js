import { z } from 'zod';
/**
 * Adaptadores de estimación y descomposición (KIN-148 / BE-11).
 *
 * Este archivo tenía las tablas de keywords del modelo de energía de Kino y un
 * prompt a Anthropic con su propia API key. Las dos cosas eran reglas de negocio
 * viviendo fuera de la app, y la segunda además hacía que el mismo tool se
 * comportara distinto por stdio que por la ruta remota `/api/mcp`, donde esa
 * variable de entorno no existe. Todo eso se mudó a
 * `src/features/insights/insights.service.ts`, con tests y endpoint propio.
 *
 * Lo que queda aquí es lo que debe quedar: traducir argumentos a una llamada.
 */
export function registerDecomposeTools(server, kinoFetch) {
    server.tool('estimate_task', 'Estima el nivel de energía (high/medium/low) y el tiempo que tomará una tarea a partir de su título y descripción. Úsalo ANTES de crear una tarea cuando el usuario no dijo cuánta energía o cuánto tiempo requiere, para rellenar esos campos con un valor por defecto razonable. Es una heurística de keywords, no un juicio: si el usuario dio su propia estimación, la suya manda.', {
        title: z.string().min(1).max(500).describe('Título de la tarea a estimar'),
        description: z
            .string()
            .optional()
            .describe('Descripción de la tarea, para una estimación más precisa'),
    }, async ({ title, description }) => {
        const estimate = await kinoFetch('/api/insights/estimate', {
            method: 'POST',
            body: JSON.stringify({ title, description }),
        });
        return { content: [{ type: 'text', text: JSON.stringify(estimate, null, 2) }] };
    });
    server.tool('reorder_by_importance', 'Devuelve las tareas de hoy ordenadas por importancia (prioridad × urgencia × antigüedad). Úsalo cuando el usuario pregunte por dónde empezar o qué es lo más importante, no para listar tareas — para eso está list_tasks.', {}, async () => {
        const suggestions = await kinoFetch('/api/insights/suggest?limit=10');
        return { content: [{ type: 'text', text: JSON.stringify(suggestions, null, 2) }] };
    });
    server.tool('generate_subtasks', 'Prepara la descomposición de una tarea compleja: devuelve la tarea, las subtareas que ya tiene y las reglas de Kino para partirla bien. Úsalo cuando el usuario pida dividir, descomponer o "hacer más manejable" una tarea. TÚ redactas las subtareas a partir de lo que devuelve, respetando `guidance` y el formato de `outputContract`; después llama a bulk_create_tasks con los valores que vienen en `outputContract.thenCallWith` para crearlas. Muéstraselas al usuario antes de crearlas.', {
        taskId: z.string().uuid().describe('UUID de la tarea a descomponer'),
        count: z
            .number()
            .int()
            .min(2)
            .max(8)
            .optional()
            .describe('Cuántas subtareas proponer (por defecto: 3)'),
    }, async ({ taskId, count }) => {
        const brief = await kinoFetch('/api/insights/decompose', {
            method: 'POST',
            body: JSON.stringify({ taskId, count }),
        });
        return { content: [{ type: 'text', text: JSON.stringify(brief, null, 2) }] };
    });
}
