import { z } from "zod";
import { endpoint, noContent, output } from "@/shared/api/contract";
import {
  changeEmailSchema,
  changePasswordSchema,
  deleteAccountSchema,
  updateAccountSchema,
} from "./account.schemas";
import type { getAccountOverview, listActiveSessions, renameAccount } from "./account.service";

type Returns<T extends (...args: never[]) => unknown> = Awaited<ReturnType<T>>;

/**
 * Todo lo de cuenta exige la sesión del navegador: una clave API o un token del
 * MCP no puede cambiar credenciales, cerrar sesiones ni borrar la cuenta,
 * aunque sean del mismo usuario.
 */
const account = endpoint.meta({ sessionOnly: true });

export const accountContract = {
  overview: account
    .route({ method: "GET", path: "/account" })
    .output(output<Returns<typeof getAccountOverview>>()),

  rename: account
    .route({ method: "PATCH", path: "/account" })
    .input(updateAccountSchema)
    .output(output<Returns<typeof renameAccount>>()),

  changePassword: account
    .route({ method: "POST", path: "/account/password" })
    .input(changePasswordSchema)
    .output(output<{ ok: true }>()),

  /** 202: el correo nuevo todavía tiene que confirmarse desde su bandeja. */
  changeEmail: account
    .route({ method: "POST", path: "/account/email", successStatus: 202 })
    .input(changeEmailSchema)
    .output(output<{ ok: true }>()),

  sessions: account
    .route({ method: "GET", path: "/account/sessions" })
    .output(output<Returns<typeof listActiveSessions>>()),

  revokeSession: account
    .route({ method: "DELETE", path: "/account/sessions/{id}", successStatus: 204 })
    .input(z.object({ id: z.string().min(1) }))
    .output(noContent()),

  revokeOtherSessions: account
    .route({ method: "POST", path: "/account/sessions/revoke-others" })
    .output(output<{ revoked: number }>()),

  remove: account
    .route({ method: "POST", path: "/account/delete" })
    .input(deleteAccountSchema)
    .output(output<{ ok: true }>()),
};
