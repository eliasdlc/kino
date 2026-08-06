import { describe, expect, it } from 'vitest';
import { SYSTEM_TYPE_CONFIG, type SystemMetadata } from './system-types';
import {
  composeManifest,
  findTaskKind,
  guessGender,
  kindIdFromLabel,
  landingSurface,
  pluralize,
  resolveManifest,
} from './system-manifest';

/**
 * La composición es la única vía por la que un sistema deja de hablar como su
 * arquetipo. Estas pruebas fijan las dos mitades del contrato: que `custom` se
 * deja componer de verdad y que ningún otro tipo se deja tocar.
 */

const composition: SystemMetadata['composition'] = {
  containers: { enabled: true, noun: 'expediente', nounPlural: 'expedientes' },
  pages: { noun: 'minuta', nounPlural: 'minutas', primary: true },
  taskKinds: [
    { id: 'audiencia', label: 'Audiencia' },
    { id: 'escrito', label: 'Escrito' },
  ],
};

describe('composeManifest', () => {
  it('renombra contenedores y deriva CTA, placeholder y género', () => {
    const m = composeManifest(SYSTEM_TYPE_CONFIG.custom, composition);
    expect(m.folderRole?.noun).toBe('expediente');
    expect(m.folderRole?.nounPlural).toBe('expedientes');
    expect(m.folderRole?.gender).toBe('m');
    expect(m.folderRole?.newLabel).toBe('Nuevo expediente');
    expect(m.folderRole?.placeholder).toBe('Nombre del expediente');
  });

  it('apaga los contenedores cuando el usuario no los quiere', () => {
    const m = composeManifest(SYSTEM_TYPE_CONFIG.custom, {
      containers: { enabled: false, noun: 'carpeta', nounPlural: 'carpetas' },
    });
    expect(m.folderRole).toBeNull();
  });

  it('renombra páginas y respeta el flag de primarias', () => {
    const m = composeManifest(SYSTEM_TYPE_CONFIG.custom, composition);
    expect(m.pageRole).toEqual({
      noun: 'minuta',
      nounPlural: 'minutas',
      gender: 'f',
      primary: true,
    });
  });

  it('monta los kinds del usuario con icono neutro y sin campos', () => {
    const m = composeManifest(SYSTEM_TYPE_CONFIG.custom, composition);
    expect(m.taskKinds.map((k) => k.id)).toEqual(['audiencia', 'escrito']);
    expect(m.taskKinds[0].fields).toEqual([]);
    expect(m.taskKinds[0].icon).toBeTruthy();
  });

  it('descarta kinds vacíos o duplicados en vez de guardarlos rotos', () => {
    const m = composeManifest(SYSTEM_TYPE_CONFIG.custom, {
      taskKinds: [
        { id: 'llamada', label: 'Llamada' },
        { id: 'llamada', label: 'Llamada otra vez' },
        { id: 'vacio', label: '   ' },
      ],
    });
    expect(m.taskKinds).toHaveLength(1);
    expect(m.taskKinds[0].label).toBe('Llamada');
  });

  it('cae a los sustantivos por defecto si el usuario deja el input en blanco', () => {
    const m = composeManifest(SYSTEM_TYPE_CONFIG.custom, {
      containers: { enabled: true, noun: '  ', nounPlural: '' },
    });
    expect(m.folderRole?.noun).toBe('carpeta');
    expect(m.folderRole?.nounPlural).toBe('carpetas');
  });
});

describe('resolveManifest', () => {
  it('deja intactos los arquetipos con opinión aunque traigan composición', () => {
    const m = resolveManifest('academic', { composition });
    expect(m.folderRole?.noun).toBe('clase');
    expect(m.pageRole.noun).toBe('apunte');
    expect(m.taskKinds.map((k) => k.id)).toEqual(
      SYSTEM_TYPE_CONFIG.academic.taskKinds.map((k) => k.id),
    );
  });

  it('trata un sistema sin templateType como custom', () => {
    const m = resolveManifest(null, { composition });
    expect(m.folderRole?.noun).toBe('expediente');
  });

  it('aplica tabs y tab por defecto guardados, para cualquier tipo', () => {
    const m = resolveManifest('personal', { tabs: ['backlog', 'archive'], defaultTab: 'archive' });
    expect(m.tabs).toEqual(['backlog', 'archive']);
    expect(m.defaultTab).toBe('archive');
  });

  it('ignora un tab por defecto que ya no está visible', () => {
    const m = resolveManifest('custom', { tabs: ['backlog'], defaultTab: 'planning' });
    expect(m.defaultTab).toBe('backlog');
  });

  it('devuelve el manifiesto base sin metadata', () => {
    expect(resolveManifest('writing', null)).toBe(SYSTEM_TYPE_CONFIG.writing);
  });
});

describe('findTaskKind', () => {
  it('encuentra los kinds compuestos por el usuario', () => {
    const m = resolveManifest('custom', { composition });
    expect(findTaskKind(m, 'audiencia')?.label).toBe('Audiencia');
    expect(findTaskKind(m, 'inventado')).toBeNull();
    expect(findTaskKind(m, 42)).toBeNull();
  });
});

describe('landingSurface', () => {
  it('abre en la biblioteca solo si un custom lo pidió', () => {
    expect(landingSurface({ templateType: 'custom', metadata: { composition } })).toBe('docs');
    expect(landingSurface({ templateType: 'custom', metadata: null })).toBe('tasks');
    // writing es pages-first, pero su propia vista ya es la biblioteca.
    expect(landingSurface({ templateType: 'writing', metadata: null })).toBe('tasks');
  });
});

describe('helpers de español', () => {
  it('adivina el género por la terminación', () => {
    expect(guessGender('tabla')).toBe('f');
    expect(guessGender('capítulo')).toBe('m');
    expect(guessGender('canción')).toBe('f');
    expect(guessGender('actividad')).toBe('f');
    expect(guessGender('expediente')).toBe('m');
  });

  it('sugiere plurales razonables', () => {
    expect(pluralize('expediente')).toBe('expedientes');
    expect(pluralize('canal')).toBe('canales');
    expect(pluralize('lápiz')).toBe('lápices');
    expect(pluralize('análisis')).toBe('análisis');
    expect(pluralize('  ')).toBe('');
  });

  it('deriva ids de kind estables y sin acentos', () => {
    expect(kindIdFromLabel('Sesión de campo')).toBe('sesion-de-campo');
    expect(kindIdFromLabel('  ¡Ojo!  ')).toBe('ojo');
    expect(kindIdFromLabel('***')).toBe('kind');
  });
});
