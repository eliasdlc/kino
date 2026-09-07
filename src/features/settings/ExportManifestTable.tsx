"use client";

import { Check, Minus } from "lucide-react";
import { EXPORT_TABLES } from "./export-manifest";

/**
 * Qué se lleva el ZIP y qué no, una fila por tabla. Sale de la misma lista que
 * arma el export, no de un array escrito a mano al lado: es lo que convierte la
 * palabra «completo» en algo comprobable en vez de una afirmación, y lo que
 * impide que la pantalla prometa veintidós tablas el día que el ZIP entregue
 * diecinueve.
 */
export function ExportManifestTable() {
  const viajan = EXPORT_TABLES.filter((t) => t.formato !== null).length;

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        {viajan} de {EXPORT_TABLES.length} tablas viajan en el ZIP. Las demás dicen por qué no.
      </p>
      <div className="overflow-hidden rounded-lg border">
        <table className="w-full text-left text-xs">
          <thead className="bg-muted/50">
            <tr>
              <th scope="col" className="p-2 font-semibold">Qué</th>
              <th scope="col" className="p-2 font-semibold">Viaja</th>
              <th scope="col" className="p-2 font-semibold">Formato</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {EXPORT_TABLES.map(({ tabla, etiqueta, formato, motivo }) => (
              <tr key={tabla}>
                <th scope="row" className="p-2 text-left font-medium">{etiqueta}</th>
                <td className="p-2">
                  {formato === null ? (
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Minus className="size-3.5 shrink-0" aria-hidden />
                      No
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-(--ok)">
                      <Check className="size-3.5 shrink-0" aria-hidden />
                      Sí
                    </span>
                  )}
                </td>
                <td className="p-2 text-muted-foreground">{formato ?? motivo}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
