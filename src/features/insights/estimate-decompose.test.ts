import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Las reglas que BE-11 (KIN-148) trajo desde `packages/mcp` a la app: la
 * estimación de energía/tiempo y el brief de descomposición. Antes vivían en el
 * adaptador MCP, sin tests. Estos son los tests que no existían.
 */

vi.mock('@/shared/db', () => ({ db: {} }));

const tasksService = vi.hoisted(() => ({
  getTaskById: vi.fn(),
  getSubtasks: vi.fn(),
}));
vi.mock('@/features/tasks/tasks.service', () => tasksService);

const { estimateTaskAttributes, buildDecompositionBrief } = await import('./insights.service');

const TASK_ID = '7b8c9d0e-1f2a-4b3c-8d4e-5f6a7b8c9d0e';
const SYSTEM_ID = '5a2b3c4d-6e7f-4a8b-9c0d-1e2f3a4b5c6d';
const USER_ID = '9c1d4f6a-2b3e-4a8c-9d5f-7e0a1b2c3d4e';

describe('estimateTaskAttributes · energía', () => {
  it('reconoce trabajo cognitivo como energía alta', () => {
    expect(estimateTaskAttributes('Analizar las métricas del trimestre').energyLevel).toBe('high');
  });

  // Además de cubrir el caso, fija el arreglo de una colisión heredada: el stem
  // alto era `archi`, que empataba con "archivar" y, al evaluarse la lista alta
  // primero, volvía inalcanzable el `archiv` de la lista baja.
  it('reconoce trabajo mecánico como energía baja', () => {
    expect(estimateTaskAttributes('Archivar los recibos de junio').energyLevel).toBe('low');
  });

  it('sigue reconociendo "architecture" como energía alta tras desambiguar el stem', () => {
    expect(estimateTaskAttributes('Review the service architecture').energyLevel).toBe('high');
  });

  it('cae en medium cuando no reconoce nada', () => {
    expect(estimateTaskAttributes('Comprar café').energyLevel).toBe('medium');
  });

  it('la energía alta gana sobre la baja cuando aparecen las dos', () => {
    expect(estimateTaskAttributes('Diseñar el flujo y mover los archivos').energyLevel).toBe('high');
  });

  it('atraviesa los acentos: "diseñar" cae en el stem "diseñ"', () => {
    expect(estimateTaskAttributes('Diseñar la arquitectura').energyLevel).toBe('high');
  });

  it('usa la descripción además del título', () => {
    expect(estimateTaskAttributes('Tarea', 'hay que investigar el proveedor').energyLevel).toBe('high');
  });

  // La regresión concreta que arregló la mudanza. La versión del paquete MCP
  // hacía `includes()` sobre la cadena entera, así que "remover" contenía el
  // keyword "move" y la tarea salía como energía baja sin motivo.
  it('no cruza fronteras de palabra: "remover" ya no cae en el keyword "move"', () => {
    expect(estimateTaskAttributes('Remover el bloqueo').energyLevel).toBe('medium');
  });
});

describe('estimateTaskAttributes · tiempo', () => {
  it('devuelve HH:MM:SS, que es el formato de la columna estimated_time', () => {
    expect(estimateTaskAttributes('Reunión con el equipo').estimatedTime).toBe('01:00:00');
  });

  it('media hora por defecto cuando ningún keyword coincide', () => {
    expect(estimateTaskAttributes('Comprar café').estimatedTime).toBe('00:30:00');
  });

  it('los tramos por debajo de la hora se rellenan con cero', () => {
    expect(estimateTaskAttributes('Deploy a producción').estimatedTime).toBe('00:30:00');
    expect(estimateTaskAttributes('Tarea rápido').estimatedTime).toBe('00:15:00');
  });

  it('pasa de una hora sin romper el formato', () => {
    expect(estimateTaskAttributes('Investigar proveedores').estimatedTime).toBe('01:30:00');
  });

  // Comportamiento heredado que se conserva a propósito: gana el primer keyword
  // de la tabla, no el más específico. Cambiarlo movería estimaciones que el
  // usuario ya conoce.
  it('gana el primer keyword de la tabla, no el más específico', () => {
    expect(estimateTaskAttributes('Review rápido del PR').estimatedTime).toBe('00:15:00');
  });

  it('el reasoning explica en qué grupo cayó', () => {
    expect(estimateTaskAttributes('Analizar datos').reasoning).toContain('análisis');
  });
});

describe('buildDecompositionBrief', () => {
  const task = {
    id: TASK_ID,
    title: 'Lanzar la beta',
    description: 'Para el viernes',
    systemId: SYSTEM_ID,
    energyLevel: 'high',
    estimatedTime: '02:00:00',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    tasksService.getTaskById.mockResolvedValue(task);
    tasksService.getSubtasks.mockResolvedValue([]);
  });

  it('devuelve null cuando la tarea no existe o no es del usuario', async () => {
    tasksService.getTaskById.mockResolvedValue(null);
    expect(await buildDecompositionBrief(USER_ID, TASK_ID)).toBeNull();
  });

  it('no consulta subtareas si la tarea no existe: aborta a medias sin trabajo de más', async () => {
    tasksService.getTaskById.mockResolvedValue(null);
    await buildDecompositionBrief(USER_ID, TASK_ID);
    expect(tasksService.getSubtasks).not.toHaveBeenCalled();
  });

  it('aísla por usuario: pasa el userId a las dos lecturas', async () => {
    await buildDecompositionBrief(USER_ID, TASK_ID);
    expect(tasksService.getTaskById).toHaveBeenCalledWith(TASK_ID, USER_ID);
    expect(tasksService.getSubtasks).toHaveBeenCalledWith(TASK_ID, USER_ID);
  });

  it('incluye las subtareas existentes para que el modelo no las repita', async () => {
    tasksService.getSubtasks.mockResolvedValue([
      { id: 'a', title: 'Escribir el changelog', description: 'x' },
    ]);
    const brief = await buildDecompositionBrief(USER_ID, TASK_ID);
    expect(brief?.existingSubtasks).toEqual([{ id: 'a', title: 'Escribir el changelog' }]);
  });

  it('el contrato de salida trae lo que bulk_create_tasks necesita', async () => {
    const brief = await buildDecompositionBrief(USER_ID, TASK_ID);
    expect(brief?.outputContract.thenCall).toBe('bulk_create_tasks');
    expect(brief?.outputContract.thenCallWith).toEqual({
      systemId: SYSTEM_ID,
      parentTaskId: TASK_ID,
    });
  });

  it('lleva las reglas de Kino, que es lo que antes vivía en el prompt del MCP', async () => {
    const brief = await buildDecompositionBrief(USER_ID, TASK_ID);
    expect(brief?.guidance.length).toBeGreaterThan(0);
  });

  it('usa 3 subtareas por defecto', async () => {
    expect((await buildDecompositionBrief(USER_ID, TASK_ID))?.count).toBe(3);
  });

  it('acota count al rango soportado en vez de confiar en el llamante', async () => {
    expect((await buildDecompositionBrief(USER_ID, TASK_ID, 99))?.count).toBe(8);
    expect((await buildDecompositionBrief(USER_ID, TASK_ID, 1))?.count).toBe(2);
    expect((await buildDecompositionBrief(USER_ID, TASK_ID, 4.7))?.count).toBe(4);
  });
});
