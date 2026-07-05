# Reminders con hora exacta — cron externo (D4)

> Fase 1.5 del [Plan Maestro](./PLAN-MAESTRO.md). Cierra BE-06 y UX-04: un
> recordatorio puesto para dentro de 20 min debe llegar en la ventana correcta,
> no al día siguiente.

## El problema

El endpoint `/api/cron/task-reminders` ya procesa los `remind_at` exactos vencidos
(`getPendingReminders`: `remind_at <= NOW() AND sent_at IS NULL`) y marca como
enviado **sólo** lo que el push entregó (BE-05/BE-09). El flujo de código está listo.

Lo único que falta es la **frecuencia del disparo**. En Vercel Hobby los crons
corren una vez al día (`vercel.json` los tiene a `0 12` y `0 13`). Con eso, un
recordatorio para dentro de 20 minutos no se envía hasta el día siguiente.

Subir la frecuencia en Vercel exige Vercel Pro ($20/mes). El endpoint autentica
por `Bearer CRON_SECRET`, así que **nada obliga a que el trigger sea de Vercel**:
un cron externo gratis cada 15 min resuelve el caso sin pagar.

## Setup (acción del owner — toca secret + servicio externo)

1. En [cron-job.org](https://cron-job.org) (gratis) crear un cronjob:
   - **URL:** `https://<tu-dominio-de-prod>/api/cron/task-reminders`
   - **Método:** GET o POST (la ruta acepta ambos).
   - **Schedule:** cada 15 minutos (`*/15 * * * *`).
   - **Header:** `Authorization: Bearer <CRON_SECRET>` — el mismo valor que la env
     var `CRON_SECRET` en Vercel. No commitear este valor.
2. Verificar la primera ejecución: respuesta `200 { ok: true, notified: N }`.
   - Sin `CRON_SECRET` en el request → `401`. Sin la env var en el server → `500`.

## Qué pasa con el cron de Vercel

`vercel.json` mantiene el disparo diario de `task-reminders` como red de seguridad
mientras el cron externo no esté vivo. Una vez confirmado el cron de 15 min, la
entrada `task-reminders` de `vercel.json` es redundante (idempotente por
`sent_at`, así que dejarla no rompe nada — sólo dispara una vez más al día).
`daily-snapshot` **se queda en Vercel**: sólo necesita correr una vez al día.

## Verificación de aceptación

Un reminder puesto para dentro de ~20 min debe llegar en la ventana de 15–30 min
tras la hora objetivo (resolución del cron de 15 min), no al día siguiente.
