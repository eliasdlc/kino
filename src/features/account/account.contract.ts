import { endpoint, output } from "@/shared/api/contract";
import { deleteAccountSchema } from "./account.schemas";
import type { getAccountOverview } from "./account.service";

type Returns<T extends (...args: never[]) => unknown> = Awaited<ReturnType<T>>;

/**
 * Lo de cuenta exige la sesión del navegador: una clave API no puede borrar la
 * cuenta aunque sea del mismo usuario. Nombre, correo, contraseña y sesiones
 * los administra Clerk desde su propio panel.
 */
const account = endpoint.meta({ sessionOnly: true });

export const accountContract = {
  overview: account
    .route({ method: "GET", path: "/account" })
    .output(output<Returns<typeof getAccountOverview>>()),

  remove: account
    .route({ method: "POST", path: "/account/delete" })
    .input(deleteAccountSchema)
    .output(output<{ ok: true }>()),
};
