'use client';

/**
 * El cuerpo de la propuesta del techo: cuántos cierres tuyos, en cuántos días,
 * y qué techo sugieren.
 *
 * Las cifras vienen con la evidencia detrás, que son ids de tareas de verdad.
 * Si el servidor no pudo resolver ninguna, la propuesta **no se pinta**: una
 * cifra sin las filas que la sostienen es una afirmación, y este producto no
 * afirma, enseña.
 */

const horas = (n: number) => `${n % 1 === 0 ? n : n.toFixed(1)} h`;

export interface CeilingProposal {
  cierres: number;
  dias: number;
  horasObservadas: number;
  propuesto: number;
  actual: number;
  evidencia: readonly string[];
}

export function CeilingProposalBody({ propuesta }: { propuesta: CeilingProposal }) {
  if (propuesta.evidencia.length === 0) return null;

  const { cierres, dias, horasObservadas, propuesto, actual } = propuesta;

  return (
    <span className="min-w-0">
      <b className="font-semibold text-foreground">
        {cierres} cierres en {dias} día{dias !== 1 ? 's' : ''}
      </b>
      , {horas(horasObservadas)} de trabajo observado.
      <span className="text-muted-foreground">
        {' '}
        Tu techo diría {horas(propuesto)} en vez de {horas(actual)}.
      </span>
    </span>
  );
}
