import { describe, expect, it } from 'vitest';
import { MEDIUM_CONFIG } from '@/shared/lib/mediums';
import { ARCHETYPE_IDENTITIES } from './onboarding.archetypes';
import { buildSeedPlan, type SeedPlan } from './onboarding.seed';

const allTasks = (plan: SeedPlan) => [...plan.tasks, ...plan.folders.flatMap((f) => f.tasks)];

describe('siembra por arquetipo', () => {
  it('el estudiante sale con sus clases y una primera entrega en cada una', () => {
    const plan = buildSeedPlan('estudiante', 'Semestre actual', [
      { name: 'Cálculo II' },
      { name: 'Historia del arte' },
    ]);

    expect(plan.folders.map((f) => f.name)).toEqual(['Cálculo II', 'Historia del arte']);
    expect(plan.folders[0].tasks).toEqual([
      {
        title: 'Primera entrega de Cálculo II',
        startsToday: false,
        energyLevel: 'medium',
        metadata: { kind: 'assignment' },
      },
    ]);
    // La tarea del sistema existe aunque no dependa de ninguna clase.
    expect(plan.tasks).toHaveLength(1);
    expect(plan.tasks[0].metadata).toEqual({ kind: 'reading' });
  });

  it('el builder no crea carpetas: lo que escribe entra como tarjeta del board', () => {
    const plan = buildSeedPlan('builder', 'Mi proyecto', [
      { name: 'Terminar el login' },
      { name: 'Publicar la landing' },
    ]);

    expect(plan.folders).toHaveLength(0);
    // 1 del sistema + 2 escritas por el usuario, todas en la primera columna.
    expect(plan.tasks).toHaveLength(3);
    expect(plan.tasks.every((t) => t.boardStatus === 'todo')).toBe(true);
    expect(plan.tasks.map((t) => t.title)).toContain('Terminar el login');
  });

  it('el escritor sale con la obra, su medium normalizado y el primer manuscrito', () => {
    const plan = buildSeedPlan('escritor', 'Escritura', [
      { name: 'La casa vacía', field: 'screenplay' },
    ]);

    const obra = plan.folders[0];
    expect(obra.metadata).toEqual({ medium: 'screenplay' });
    expect(obra.page).toEqual({
      title: 'Escena 1',
      content: MEDIUM_CONFIG.screenplay.template,
    });
    expect(obra.tasks[0].title).toBe('Primera sesión de escritura en La casa vacía');
  });

  it('la novela nace en blanco y con el vocabulario de su medium', () => {
    const plan = buildSeedPlan('escritor', 'Escritura', [{ name: 'Mi novela', field: 'novel' }]);
    // Plantilla vacía → la página arranca sin contenido, no con un string vacío.
    expect(plan.folders[0].page).toEqual({ title: 'Capítulo 1', content: null });
  });

  it('un medium que no existe cae al default en vez de entrar crudo a metadata', () => {
    const plan = buildSeedPlan('escritor', 'Escritura', [{ name: 'Algo', field: 'poesía-épica' }]);
    expect(plan.folders[0].metadata).toEqual({ medium: 'novel' });
  });

  it('acepta el nombre viejo en español del medium (obras importadas)', () => {
    const plan = buildSeedPlan('escritor', 'Escritura', [{ name: 'Algo', field: 'guión' }]);
    expect(plan.folders[0].metadata).toEqual({ medium: 'screenplay' });
  });

  it('el emprendedor interpola el milestone en su primer experimento', () => {
    const plan = buildSeedPlan('emprendedor', 'Mi startup', [{ name: 'Lanzar la beta' }]);
    expect(plan.folders[0].tasks[0].title).toBe('Primer experimento para Lanzar la beta');
    expect(plan.folders[0].tasks[0].metadata).toEqual({ kind: 'experiment' });
  });

  it('descarta unidades vacías y recorta las que pasan del máximo del arquetipo', () => {
    const plan = buildSeedPlan('estudiante', 'Semestre', [
      { name: 'Álgebra' },
      { name: '   ' },
      { name: '' },
      { name: 'Física' },
      { name: 'Química' },
      { name: 'Historia' },
      { name: 'Inglés' },
      { name: 'Ética' },
      { name: 'Filosofía' },
      { name: 'Sobrante' },
    ]);
    expect(plan.folders).toHaveLength(6);
    expect(plan.folders.map((f) => f.name)).not.toContain('Sobrante');
  });

  it('sin unidades, el sistema arranca solo con lo que el arquetipo promete', () => {
    expect(buildSeedPlan('estudiante', 'Semestre', []).tasks).toHaveLength(1);
    // `propio` no declara tareas de sistema: si no escribes nada, no se inventa
    // un tutorial de relleno.
    const propio = buildSeedPlan('propio', 'Trabajo', []);
    expect(propio.tasks).toHaveLength(0);
    expect(propio.folders).toHaveLength(0);
  });

  it('nunca estrena el día con más de una tarea, sean cuantas sean las unidades', () => {
    // Cinco unidades no pueden producir cinco tareas de hoy: el primer día se
    // abre con un paso, no con una lista imposible.
    for (const identity of ARCHETYPE_IDENTITIES) {
      const units = ['Uno', 'Dos', 'Tres', 'Cuatro', 'Cinco'].map((name) => ({ name }));
      const today = allTasks(buildSeedPlan(identity, 'Sistema', units)).filter((t) => t.startsToday);
      expect(today.length, identity).toBeLessThanOrEqual(1);
    }
  });

  it('lo que la persona escribe nunca arranca hoy por su cuenta', () => {
    // Solo el manifiesto decide qué estrena el día; el texto del usuario entra
    // al backlog aunque su arquetipo tenga una tarea de hoy.
    const plan = buildSeedPlan('builder', 'Mi proyecto', [{ name: 'Terminar el login' }]);
    expect(plan.tasks.find((t) => t.title === 'Terminar el login')!.startsToday).toBe(false);
  });

  it('lo que escribe quien elige "algo mío" queda tal cual como tarea', () => {
    const plan = buildSeedPlan('propio', 'Trabajo', [{ name: 'Llamar al banco' }]);
    expect(plan.folders).toHaveLength(0);
    expect(plan.tasks).toEqual([
      { title: 'Llamar al banco', startsToday: false, metadata: null },
    ]);
  });
});
