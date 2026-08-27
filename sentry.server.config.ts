import * as Sentry from "@sentry/nextjs";
import { sentryBaseOptions } from "@/shared/observability/sentry-options";

// Node: rutas de API, server components y crons. Lo importa
// `src/instrumentation.ts` cuando el runtime es `nodejs`.
Sentry.init({ ...sentryBaseOptions });
