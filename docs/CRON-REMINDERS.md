# Reminders con hora exacta — cron externo (D4)

> Fase 1.5 del [Plan Maestro](./PLAN-MAESTRO.md). Cierra BE-06 y UX-04: un
> recordatorio puesto para dentro de 20 min debe llegar en la ventana correcta,
> no ~1h tarde ni al día siguiente.

## Por qué un cron externo

El endpoint `/api/cron/task-reminders` ya procesa los `remind_at` exactos vencidos
(`getPendingReminders`: `remind_at <= NOW() AND sent_at IS NULL`) y marca como
enviado **sólo** lo que el push entregó (BE-05/BE-09). El flujo de código está listo;
lo único que importa es **la frecuencia del disparo**.

- **Vercel Hobby** corre crons 1×/día → un reminder de +20 min no sale hasta el día
  siguiente. Subir la frecuencia exige Vercel Pro ($20/mes).
- **GitHub Actions** (`schedule`) es *best-effort*: bajo carga global retrasa y
  descarta ticks; un `*/15` real corre ~1×/hora. Insuficiente para "recuérdame en 20 min".
- **cron-job.org** (gratis, dedicado) dispara con resolución real de ~1 min. Es el
  que usamos. El endpoint autentica por `Bearer CRON_SECRET`, así que el trigger
  puede venir de cualquier lado.

## Reparto de crons (estado actual)

| Job | Trigger | Frecuencia |
|-----|---------|-----------|
| `daily-snapshot` | **Vercel** (`vercel.json`) | 1×/día 12:00 UTC — genuinamente diario |
| `task-reminders` | **cron-job.org** | cada 15 min |

`task-reminders` ya **no** está en `vercel.json` ni en GitHub Actions: fuente única.

## Setup en cron-job.org (acción del owner — toca el secret)

1. **Conseguir el `CRON_SECRET`.** Es el mismo valor que la env var `CRON_SECRET`
   en Vercel prod (Project → Settings → Environment Variables → revelar) o en tu
   `.env.local` local. No lo pegues en ningún archivo versionado.
2. En [cron-job.org](https://cron-job.org) crear cuenta gratis → **Create cronjob**.
3. Configurar:
   - **Title:** `Kino task reminders` (libre).
   - **URL:** `https://www.usekino.dev/api/cron/task-reminders`
   - **Schedule:** *Every 15 minutes* (minutos `0,15,30,45`, cada hora, cada día).
   - **Request method:** GET (la ruta acepta GET y POST; GET es lo más simple).
   - **Headers** → añadir uno:
     - Key: `Authorization`
     - Value: `Bearer <tu CRON_SECRET>`
   - (Opcional) activar *notify on failure*.
4. Guardar y pulsar **Run now / Test run** → debe responder `200` con cuerpo
   `{"ok":true,"notified":N}`. Revisar el historial de ejecuciones del cronjob.

### Comprobaciones de que el guard funciona
- Sin el header `Authorization` → `401` (bien: rechaza).
- Si `CRON_SECRET` no estuviera en el server → `500` (falla cerrado, no autentica por accidente).

## Verificación de aceptación

Poner un reminder para dentro de ~20 min y confirmar que el push llega en la
ventana de 15–30 min tras la hora objetivo (resolución del cron de 15 min), no ~1h
tarde ni al día siguiente.
