import { tasksRouter } from "@/features/tasks/tasks.router";

/**
 * Los slices que ya se sirven desde su contrato. Lo que no esté aquí sigue
 * viviendo en su propio `route.ts` con el wrapper `route()`, y las dos formas
 * conviven: Next resuelve primero el archivo más específico y sólo lo que
 * ninguno reclama llega al handler del contrato.
 *
 * Esta composición es lo único central; la definición de cada contrato vive en
 * su slice, al lado de sus schemas.
 */
export const apiRouter = {
  tasks: tasksRouter,
};
