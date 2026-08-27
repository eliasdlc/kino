import * as Sentry from "@sentry/nextjs";
import { sentryBaseOptions } from "@/shared/observability/sentry-options";

// El proxy corre sobre Node por el contador de rate limit, pero Next puede
// mover a edge cualquier ruta que lo declare. Sin esto, eso quedaría ciego.
Sentry.init({ ...sentryBaseOptions });
