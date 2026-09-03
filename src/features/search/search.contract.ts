import { z } from "zod";
import { endpoint, output } from "@/shared/api/contract";
import type { SearchResult } from "./search.types";

export const searchContract = {
  all: endpoint
    // `q` es opcional para conservar lo que hacía la ruta: sin término no hay
    // error, hay lista vacía. El Cmd+K pregunta mientras se teclea.
    .route({ method: "GET", path: "/search" })
    .input(z.object({ q: z.string().optional() }))
    .output(output<SearchResult[]>()),
};
