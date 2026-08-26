import { endpoint, output } from "@/shared/api/contract";
import { setupProfileSchema } from "./onboarding.schemas";

/**
 * El onboarding es flujo de UI y nada más: ocurre antes de que exista ninguna
 * clave API, así que las dos operaciones exigen la sesión del navegador.
 */
export const onboardingContract = {
  status: endpoint
    .route({ method: "GET", path: "/onboarding/status" })
    .meta({ sessionOnly: true })
    .output(output<{ completed: boolean }>()),

  complete: endpoint
    .route({ method: "POST", path: "/onboarding/complete" })
    .meta({ sessionOnly: true })
    .input(setupProfileSchema)
    .output(output<{ ok: true }>()),
};
