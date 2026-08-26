import { tasksContract } from "@/features/tasks/tasks.contract";

/**
 * El contrato completo, que es lo único que el cliente necesita importar. No
 * arrastra ni servicios ni base de datos: por eso el cliente puede tiparse
 * entero sin que nada del servidor entre en el bundle.
 */
export const apiContract = {
  tasks: tasksContract,
};
