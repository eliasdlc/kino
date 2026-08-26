import { z } from "zod";
import { endpoint, noContent, output } from "@/shared/api/contract";
import { linkRepoSchema } from "./github-sync.schemas";
import type { GithubConnectionStatus, SyncResult } from "./github-sync.types";
import type { linkRepo } from "./github-sync.service";

type Returns<T extends (...args: never[]) => unknown> = Awaited<ReturnType<T>>;

/**
 * La conexión con GitHub y el repositorio que alimenta un board.
 *
 * El arranque del OAuth y su vuelta no están aquí: los dos terminan en un 302,
 * no en JSON, y viven en `github-sync.routes.ts` con su razón escrita.
 */
export const githubContract = {
  status: endpoint
    .route({ method: "GET", path: "/integrations/github" })
    .output(output<GithubConnectionStatus & { configured: boolean }>()),

  disconnect: endpoint
    .route({ method: "DELETE", path: "/integrations/github", successStatus: 204 })
    .output(noContent()),

  linkRepo: endpoint
    .route({ method: "POST", path: "/systems/{id}/github/link" })
    // `linkRepoSchema` es un pipe (acepta `fullName` o `owner`/`repo`), así que
    // no se puede extender: el id se añade por intersección.
    .input(z.intersection(z.object({ id: z.string().uuid() }), linkRepoSchema))
    .output(output<Returns<typeof linkRepo>>()),

  unlinkRepo: endpoint
    .route({ method: "DELETE", path: "/systems/{id}/github/link", successStatus: 204 })
    .input(z.object({ id: z.string().uuid() }))
    .output(noContent()),

  sync: endpoint
    .route({ method: "POST", path: "/systems/{id}/github/sync" })
    .input(z.object({ id: z.string().uuid() }))
    .output(output<SyncResult>()),
};
