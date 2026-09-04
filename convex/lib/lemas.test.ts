import { describe, expect, it } from 'vitest';
import { lematizar } from './lemas';

describe('lematizar', () => {
  it('reduce flexiones a la misma raíz sin acentos', () => {
    expect(lematizar('Escribiendo las reuniones')).toBe('escrib las reunion');
    expect(lematizar('escribir reunión')).toBe('escrib reunion');
  });

  it('una consulta y el texto guardado comparten raíces', () => {
    const guardado = lematizar('Reunión con el equipo de energía');
    for (const raiz of lematizar('reuniones energia').split(' ')) {
      expect(guardado.split(' ')).toContain(raiz);
    }
  });

  it('ignora HTML, vacíos y repite ninguna raíz', () => {
    expect(lematizar('<p>Hola</p>', null, undefined, '<b>hola</b> HOLA')).toBe('hol');
  });
});
