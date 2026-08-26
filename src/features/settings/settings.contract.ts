import { endpoint, output } from "@/shared/api/contract";
import { updateUserSettingsSchema } from "./settings.schemas";
import type { UserSettings } from "./settings.service";

export const settingsContract = {
  get: endpoint
    .route({ method: "GET", path: "/settings" })
    .output(output<UserSettings>()),

  update: endpoint
    .route({ method: "PATCH", path: "/settings" })
    .input(updateUserSettingsSchema)
    .output(output<UserSettings>()),
};
