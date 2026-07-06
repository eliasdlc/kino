import { afterEach, describe, expect, it, vi } from 'vitest';

// El service arrastra la conexión db; lo mockeamos para probar sólo el guard.
vi.mock('@/features/notifications/notifications.service', () => ({
  sendTaskReminders: vi.fn().mockResolvedValue({ notified: 0 }),
}));

import { GET, POST } from './route';

const req = (auth?: string) =>
  new Request('http://localhost/api/cron/task-reminders', {
    headers: auth ? { authorization: auth } : {},
  });

const originalSecret = process.env.CRON_SECRET;
afterEach(() => {
  if (originalSecret === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = originalSecret;
  vi.clearAllMocks();
});

describe('GET /api/cron/task-reminders', () => {
  it('responde 500 (no 200) si CRON_SECRET no está configurado', async () => {
    delete process.env.CRON_SECRET;
    const res = await GET(req('Bearer undefined'));
    expect(res.status).toBe(500);
  });

  it('responde 401 con secret configurado pero bearer incorrecto', async () => {
    process.env.CRON_SECRET = 'real-secret';
    const res = await GET(req('Bearer wrong'));
    expect(res.status).toBe(401);
  });

  it('responde 200 con el bearer correcto', async () => {
    process.env.CRON_SECRET = 'real-secret';
    const res = await GET(req('Bearer real-secret'));
    expect(res.status).toBe(200);
  });

  // El cron externo (cron-job.org, cada 15 min) puede disparar por POST; comparte
  // el mismo guard que GET.
  it('POST responde 200 con el bearer correcto', async () => {
    process.env.CRON_SECRET = 'real-secret';
    const res = await POST(req('Bearer real-secret'));
    expect(res.status).toBe(200);
  });

  it('POST responde 401 con bearer incorrecto', async () => {
    process.env.CRON_SECRET = 'real-secret';
    const res = await POST(req('Bearer wrong'));
    expect(res.status).toBe(401);
  });
});
