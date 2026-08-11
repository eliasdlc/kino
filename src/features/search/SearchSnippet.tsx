"use client";

import * as React from "react";
import { splitSnippet } from "./search.types";

/**
 * Pinta el fragmento devuelto por `ts_headline` resaltando la coincidencia.
 *
 * El servidor marca los tramos con caracteres de control en vez de HTML, así que
 * aquí se parte la cadena y se envuelve en JSX. Nunca `dangerouslySetInnerHTML`:
 * el fragmento sale del contenido que escribió el usuario.
 */
export function SearchSnippet({ snippet }: { snippet: string }) {
  return (
    <span className="block truncate text-xs text-muted-foreground">
      {splitSnippet(snippet).map((part, i) =>
        part.match ? (
          <mark key={i} className="bg-transparent font-medium text-foreground">
            {part.text}
          </mark>
        ) : (
          <React.Fragment key={i}>{part.text}</React.Fragment>
        ),
      )}
    </span>
  );
}
