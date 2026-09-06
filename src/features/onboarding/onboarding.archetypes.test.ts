import { describe, expect, it } from 'vitest';
import { ICON_MAP } from '@/features/systems/system-icons';
import { PROJECT_BOARD_COLUMNS, SYSTEM_TYPE_CONFIG } from '@/shared/lib/system-types';
import {
  ARCHETYPE_IDENTITIES,
  ARCHETYPE_LIST,
  ONBOARDING_ARCHETYPES,
  archetypeEnergyIdeal,
  identityFromLandingSlug,
  seedUnitField,
  seedUnitNoun,
} from './onboarding.archetypes';

/**
 * El manifiesto de identidad es datos, no código: estas pruebas son su
 * validación. Un kind que el arquetipo no declara o un icono con typo no
 * revientan en runtime: degradan en silencio. Aquí no.
 */
describe('manifiesto de identidad', () => {
  it('cubre todas las identidades y cada entrada conoce su propia clave', () => {
    expect(ARCHETYPE_LIST).toHaveLength(ARCHETYPE_IDENTITIES.length);
    for (const id of ARCHETYPE_IDENTITIES) {
      expect(ONBOARDING_ARCHETYPES[id].id).toBe(id);
    }
  });

  it('apunta a arquetipos reales y nunca al inbox', () => {
    for (const archetype of ARCHETYPE_LIST) {
      expect(SYSTEM_TYPE_CONFIG[archetype.systemType]).toBeDefined();
      expect(archetype.systemType).not.toBe('inbox');
    }
  });

  it('solo siembra task kinds declarados por el arquetipo', () => {
    for (const archetype of ARCHETYPE_LIST) {
      const declared = SYSTEM_TYPE_CONFIG[archetype.systemType].taskKinds.map((k) => k.id);
      const specs = [
        ...archetype.seed.systemTasks,
        ...archetype.seed.unitTasks,
        ...(archetype.seed.unitTaskDefaults ? [archetype.seed.unitTaskDefaults] : []),
      ];
      for (const spec of specs) {
        if (spec.kind) expect(declared).toContain(spec.kind);
      }
    }
  });

  it('solo usa carpetas en arquetipos que las tienen', () => {
    for (const archetype of ARCHETYPE_LIST) {
      if (archetype.seed.unitKind !== 'folder') continue;
      expect(SYSTEM_TYPE_CONFIG[archetype.systemType].folderRole).not.toBeNull();
    }
  });

  it('resuelve el campo extra por unidad contra el folderRole del arquetipo', () => {
    for (const archetype of ARCHETYPE_LIST) {
      if (!archetype.seed.unitFieldId) {
        expect(seedUnitField(archetype)).toBeNull();
        continue;
      }
      const field = seedUnitField(archetype);
      expect(field?.id).toBe(archetype.seed.unitFieldId);
      // Un `select` sin opciones dejaría el formulario sin nada que elegir.
      if (field?.input === 'select') expect(field.options?.length).toBeGreaterThan(0);
    }
  });

  it('siembra el primer manuscrito solo donde hay carpetas que lo contengan', () => {
    for (const archetype of ARCHETYPE_LIST) {
      if (!archetype.seed.seedFirstPage) continue;
      expect(archetype.seed.unitKind).toBe('folder');
    }
  });

  it('nace con un icono que el selector de sistemas conoce', () => {
    for (const archetype of ARCHETYPE_LIST) {
      expect(ICON_MAP[archetype.systemIcon]).toBeDefined();
    }
  });

  it('solo pone tarjetas en el board del arquetipo que tiene board', () => {
    const columns = PROJECT_BOARD_COLUMNS.map((c) => c.id) as string[];
    for (const archetype of ARCHETYPE_LIST) {
      const specs = [
        ...archetype.seed.systemTasks,
        ...archetype.seed.unitTasks,
        ...(archetype.seed.unitTaskDefaults ? [archetype.seed.unitTaskDefaults] : []),
      ];
      for (const spec of specs) {
        if (!spec.boardStatus) continue;
        expect(archetype.systemType).toBe('project');
        expect(columns).toContain(spec.boardStatus);
      }
    }
  });

  it('estrena el día con una sola tarea por arquetipo, como mucho', () => {
    for (const archetype of ARCHETYPE_LIST) {
      const specs = [
        ...archetype.seed.systemTasks,
        ...archetype.seed.unitTasks,
        ...(archetype.seed.unitTaskDefaults ? [archetype.seed.unitTaskDefaults] : []),
      ];
      expect(specs.filter((s) => s.startsToday).length).toBeLessThanOrEqual(1);
      // Lo que escribe la persona nunca se agenda solo.
      expect(archetype.seed.unitTaskDefaults?.startsToday).toBeFalsy();
    }
  });

  it('declara ejemplos de siembra dentro del máximo que admite', () => {
    for (const archetype of ARCHETYPE_LIST) {
      expect(archetype.seed.placeholders.length).toBeGreaterThan(0);
      expect(archetype.seed.placeholders.length).toBeLessThanOrEqual(archetype.seed.maxUnits);
      // El schema de la ruta corta en 6 unidades: un máximo mayor prometería
      // slots que el server rechazaría.
      expect(archetype.seed.maxUnits).toBeLessThanOrEqual(6);
    }
  });

  it('no repite el slug de landing entre segmentos', () => {
    const slugs = ARCHETYPE_LIST.map((a) => a.landingSlug).filter((s): s is string => s !== null);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('deriva la energía ideal del manifiesto y descarta la que la columna no admite', () => {
    // `writing` es high en el manifiesto; `custom` no declara nada y `personal`
    // sería `flexible`: ninguno de esos dos puede entrar en energy_ideal.
    expect(archetypeEnergyIdeal(ONBOARDING_ARCHETYPES.escritor)).toBe('high');
    expect(archetypeEnergyIdeal(ONBOARDING_ARCHETYPES.estudiante)).toBe('medium');
    expect(archetypeEnergyIdeal(ONBOARDING_ARCHETYPES.propio)).toBeUndefined();
  });

  it('usa el vocabulario del arquetipo para nombrar la unidad sembrada', () => {
    expect(seedUnitNoun(ONBOARDING_ARCHETYPES.estudiante)).toEqual({
      singular: 'clase',
      plural: 'clases',
    });
    expect(seedUnitNoun(ONBOARDING_ARCHETYPES.escritor).singular).toBe('obra');
    // Sin carpetas, la unidad es la tarea.
    expect(seedUnitNoun(ONBOARDING_ARCHETYPES.builder)).toEqual({
      singular: 'tarea',
      plural: 'tareas',
    });
  });
});

describe('identidad desde la landing', () => {
  it('reconoce el slug del segmento y también el id crudo', () => {
    expect(identityFromLandingSlug('escritores')).toBe('escritor');
    expect(identityFromLandingSlug('Estudiantes')).toBe('estudiante');
    expect(identityFromLandingSlug('  builders ')).toBe('builder');
    expect(identityFromLandingSlug('emprendedor')).toBe('emprendedor');
  });

  it('no rompe el onboarding con un slug que no existe', () => {
    expect(identityFromLandingSlug('astronautas')).toBeNull();
    expect(identityFromLandingSlug('')).toBeNull();
    expect(identityFromLandingSlug(undefined)).toBeNull();
  });
});
