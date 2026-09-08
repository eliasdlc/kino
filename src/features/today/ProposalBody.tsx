import Link from "next/link";

/**
 * El cuerpo de la línea de una propuesta del agente, en Hoy.
 *
 * **La evidencia se pinta como enlace a la fila que la justifica.** Es la
 * diferencia entre una propuesta y una afirmación: el servidor resuelve la
 * referencia y la pinta, así que lo que se lee existe. Si la fila hubiera
 * desaparecido, esta línea no se pintaría: eso se decide antes, en el servidor.
 *
 * Una tarea no tiene página propia, así que su enlace lleva al sistema donde
 * vive, que es donde se la encuentra.
 */

export type ProposalEvidence = {
  tipo: "task" | "page";
  id: string;
  titulo: string | null;
  systemId: string | null;
};

export type Proposal = {
  kind: "cancel" | "rewrite";
  motivo: string | null;
  evidencia: ProposalEvidence;
};

const VERBO: Record<Proposal["kind"], string> = {
  cancel: "Tu agente propone mandar a la papelera",
  rewrite: "Tu agente propone reescribir el cuerpo de",
};

function rutaDe(evidencia: ProposalEvidence): string | null {
  if (!evidencia.systemId) return null;
  return evidencia.tipo === "page"
    ? `/systems/${evidencia.systemId}/pages/${evidencia.id}`
    : `/systems/${evidencia.systemId}`;
}

export function ProposalBody({ propuesta }: { propuesta: Proposal }) {
  const { evidencia } = propuesta;
  const titulo = evidencia.titulo ?? "algo sin título";
  const ruta = rutaDe(evidencia);

  return (
    <>
      {VERBO[propuesta.kind]}{" "}
      {ruta ? (
        <Link href={ruta} className="font-semibold text-foreground underline underline-offset-2">
          {titulo}
        </Link>
      ) : (
        <b className="font-semibold text-foreground">{titulo}</b>
      )}
      {propuesta.motivo !== null && `: ${propuesta.motivo}`}
    </>
  );
}
