import { beforeEach, describe, expect, it, vi } from 'vitest';

// web-push y las queries (que importan la conexión db) se mockean: este test
// verifica la lógica de "marcar sólo lo entregado", sin red ni base de datos.
vi.mock('web-push', () => ({
  default: { setVapidDetails: vi.fn(), sendNotification: vi.fn() },
}));

vi.mock('./notifications.queries', () => ({
  getPushSubscriptions: vi.fn(),
  deletePushSubscription: vi.fn(),
  getUserIdsWithPushSubscriptions: vi.fn(),
  getTasksDueTodayUnnotified: vi.fn(),
  getTasksDueTomorrowUnnotified: vi.fn(),
  markTasksNotifiedDueDay: vi.fn(),
  markTasksNotifiedBeforeDay: vi.fn(),
  getPendingReminders: vi.fn(),
  markRemindersSent: vi.fn(),
  getTasksForEscalation: vi.fn(),
  updateTaskEscalation: vi.fn(),
}));

process.env.VAPID_PUBLIC_KEY = 'test-public';
process.env.VAPID_PRIVATE_KEY = 'test-private';

import webpush from 'web-push';
import * as queries from './notifications.queries';
import { sendTaskReminders } from './notifications.service';

const sendNotification = vi.mocked(webpush.sendNotification);
const q = vi.mocked(queries);

beforeEach(() => {
  vi.clearAllMocks();
  // Por defecto: sólo el flujo "due today" tiene datos; los otros senders vacíos.
  q.getUserIdsWithPushSubscriptions.mockResolvedValue(['userA']);
  q.getTasksDueTodayUnnotified.mockResolvedValue([
    { id: 'ta', userId: 'userA', title: 'Entregar informe' },
  ] as never);
  q.getTasksDueTomorrowUnnotified.mockResolvedValue([] as never);
  q.getPendingReminders.mockResolvedValue([] as never);
  q.getTasksForEscalation.mockResolvedValue([] as never);
  q.getPushSubscriptions.mockResolvedValue([
    { endpoint: 'https://push/e', authKey: 'a', p256dhKey: 'p' },
  ] as never);
});

describe('sendStandardReminders (vía sendTaskReminders)', () => {
  it('NO marca la tarea si el push fue rechazado (re-intentable)', async () => {
    sendNotification.mockRejectedValue(new Error('push service down') as never);

    await sendTaskReminders();

    // Con el código viejo se marcaba en bloque (['ta']); ahora queda sin marcar.
    expect(q.markTasksNotifiedDueDay).toHaveBeenCalledWith([]);
  });

  it('SÍ marca la tarea cuando el push se entregó', async () => {
    sendNotification.mockResolvedValue(undefined as never);

    await sendTaskReminders();

    expect(q.markTasksNotifiedDueDay).toHaveBeenCalledWith(['ta']);
  });

  it('marca sólo las tareas de los usuarios cuyo push resolvió', async () => {
    q.getUserIdsWithPushSubscriptions.mockResolvedValue(['userA', 'userB']);
    q.getTasksDueTodayUnnotified.mockResolvedValue([
      { id: 'ta', userId: 'userA', title: 'A' },
      { id: 'tb', userId: 'userB', title: 'B' },
    ] as never);
    // userA falla, userB entrega.
    sendNotification.mockImplementation((sub: unknown) => {
      const endpoint = (sub as { endpoint: string }).endpoint;
      return endpoint.includes('B') ? Promise.resolve(undefined as never) : Promise.reject(new Error('fail'));
    });
    q.getPushSubscriptions.mockImplementation((userId: string) =>
      Promise.resolve([
        { endpoint: `https://push/${userId === 'userB' ? 'B' : 'A'}`, authKey: 'a', p256dhKey: 'p' },
      ]) as never,
    );

    await sendTaskReminders();

    const marked = q.markTasksNotifiedDueDay.mock.calls[0]![0] as string[];
    expect(marked).toEqual(['tb']);
  });
});
