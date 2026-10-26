/**
 * Qué se prueba: la forma de clave de una carpeta y de un repo, que es lo que
 * decide si dos maneras de escribir el mismo sitio encuentran la misma regla.
 */
import { describe, expect, it } from 'vitest';
import { normalizePath, normalizeRemote, pathAncestors, workdirCandidates } from './workdir';

describe('normalizePath', () => {
  it('quita barras repetidas y la final, y resuelve . y ..', () => {
    expect(normalizePath('/home/ana/Universidad/')).toBe('/home/ana/Universidad');
    expect(normalizePath('  /home//ana/./x/../Universidad  ')).toBe('/home/ana/Universidad');
    expect(normalizePath('/')).toBe('/');
  });

  it('rechaza lo que no es una ruta absoluta', () => {
    expect(normalizePath('~/Documents')).toBeNull();
    expect(normalizePath('Documents/Universidad')).toBeNull();
    expect(normalizePath('C:\\Users\\ana')).toBeNull();
  });
});

describe('pathAncestors', () => {
  it('va de la carpeta a la raíz por segmentos enteros', () => {
    expect(pathAncestors('/a/Universidad/tema1')).toEqual(['/a/Universidad/tema1', '/a/Universidad', '/a', '/']);
    expect(pathAncestors('/a/Universidad')).not.toContain('/a/Uni');
    expect(pathAncestors('/')).toEqual(['/']);
  });
});

describe('normalizeRemote', () => {
  it('las formas de escribir el mismo repo dan la misma clave', () => {
    for (const remote of [
      'https://github.com/eliasdlc/kino.git',
      'https://github.com/eliasdlc/kino/',
      'git@github.com:eliasdlc/kino.git',
      'ssh://git@github.com/eliasdlc/kino',
      'github.com/EliasDLC/Kino',
    ]) {
      expect(normalizeRemote(remote), remote).toBe('github.com/eliasdlc/kino');
    }
  });

  it('las credenciales de una URL no llegan a la clave', () => {
    expect(normalizeRemote('https://ana:clave@github.com/ana/tesis.git')).toBe('github.com/ana/tesis');
  });

  it('rechaza un remoto local o sin repo', () => {
    expect(normalizeRemote('/srv/git/tesis.git')).toBeNull();
    expect(normalizeRemote('file:///srv/git/tesis.git')).toBeNull();
    expect(normalizeRemote('https://github.com/')).toBeNull();
  });
});

describe('workdirCandidates', () => {
  it('prueba el repo primero y después cada carpeta de la más profunda a la raíz', () => {
    expect(workdirCandidates({ path: '/a/b', repo: 'github.com/x/y' })).toEqual([
      { kind: 'repo', key: 'github.com/x/y' },
      { kind: 'path', key: '/a/b' },
      { kind: 'path', key: '/a' },
      { kind: 'path', key: '/' },
    ]);
  });
});
