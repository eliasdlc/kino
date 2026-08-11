import { describe, expect, it } from 'vitest';
import { SYSTEM_TYPE_CONFIG } from './system-types';
import { resolveManifest } from './system-manifest';
import {
  containerDetailEmptyCopy,
  containersEmptyCopy,
  pagesEmptyCopy,
  tasksEmptyCopy,
} from './archetype-copy';

/**
 * Lo que se prueba aquí no es la redacción sino que el copy salga del manifiesto
 * y concuerde en género: la diferencia entre "crea la primera clase" y "crear
 * primero clase" es la que separa un producto de una traducción automática.
 */

describe('estados vacíos por arquetipo', () => {
  it('nombra los contenedores del arquetipo, no "carpetas"', () => {
    expect(containersEmptyCopy(SYSTEM_TYPE_CONFIG.academic)).toEqual({
      title: 'Todavía no tienes clases',
      hint: 'Crea la primera clase y organiza el resto desde ahí.',
    });
    expect(containersEmptyCopy(SYSTEM_TYPE_CONFIG.entrepreneurial)).toEqual({
      title: 'Todavía no tienes milestones',
      hint: 'Crea el primer milestone y organiza el resto desde ahí.',
    });
  });

  it('calla en los arquetipos que no ofrecen contenedores', () => {
    expect(containersEmptyCopy(SYSTEM_TYPE_CONFIG.project)).toBeNull();
    expect(containersEmptyCopy(SYSTEM_TYPE_CONFIG.inbox)).toBeNull();
  });

  it('usa el sustantivo de página y menciona los contenedores si existen', () => {
    expect(pagesEmptyCopy(SYSTEM_TYPE_CONFIG.academic)).toEqual({
      title: 'Todavía no tienes apuntes',
      hint: 'Crea el primer apunte y, si quieres, agrúpalos en clases.',
    });
    expect(pagesEmptyCopy(SYSTEM_TYPE_CONFIG.project)).toEqual({
      title: 'Todavía no tienes docs',
      hint: 'Crea el primer doc para empezar a escribir.',
    });
  });

  it('concuerda el detalle de un contenedor vacío con su género', () => {
    expect(containerDetailEmptyCopy(SYSTEM_TYPE_CONFIG.academic).title).toBe('Esta clase está vacía');
    expect(containerDetailEmptyCopy(SYSTEM_TYPE_CONFIG.entrepreneurial).title).toBe(
      'Este milestone está vacío',
    );
  });

  it('lleva el vocabulario al funnel de tareas', () => {
    expect(tasksEmptyCopy(SYSTEM_TYPE_CONFIG.academic, 'backlog').hint).toContain('tus clases');
    expect(tasksEmptyCopy(SYSTEM_TYPE_CONFIG.writing, 'action').hint).toContain('tus obras');
    expect(tasksEmptyCopy(SYSTEM_TYPE_CONFIG.project, 'backlog').hint).not.toContain('tus');
  });

  it('habla el idioma que el usuario compuso en un sistema custom', () => {
    const manifest = resolveManifest('custom', {
      composition: {
        containers: { enabled: true, noun: 'expediente', nounPlural: 'expedientes' },
        pages: { noun: 'minuta', nounPlural: 'minutas', primary: false },
      },
    });
    expect(containersEmptyCopy(manifest)?.title).toBe('Todavía no tienes expedientes');
    expect(pagesEmptyCopy(manifest).hint).toBe(
      'Crea la primera minuta y, si quieres, agrúpalas en expedientes.',
    );
    expect(tasksEmptyCopy(manifest, 'archive').hint).toContain('tus expedientes');
  });
});
