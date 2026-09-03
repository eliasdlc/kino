import { implement } from "@orpc/server";
import { authenticate, translateDomainErrors, type ApiContext } from "@/shared/api/procedures";
import { NotFoundError } from "@/shared/utils/error";
import { notificationsContract } from "./notifications.contract";
import {
  createTaskReminder,
  deletePushSubscription,
  deleteTaskReminder,
  getTaskRemindersForTask,
  ownsActiveTask,
  upsertPushSubscription,
} from "./notifications.queries";

const os = implement(notificationsContract)
  .$context<ApiContext>()
  .use(translateDomainErrors)
  .use(authenticate);

export const notificationsRouter = os.router({
  subscribe: os.subscribe.handler(async ({ context, input }) => {
    await upsertPushSubscription(context.userId, {
      endpoint: input.endpoint,
      auth: input.keys.auth,
      p256dh: input.keys.p256dh,
    });
    return { ok: true as const };
  }),

  unsubscribe: os.unsubscribe.handler(async ({ input }) => {
    await deletePushSubscription(input.endpoint);
  }),

  reminders: os.reminders.handler(({ context, input }) =>
    getTaskRemindersForTask(input.taskId, context.userId),
  ),

  createReminder: os.createReminder.handler(async ({ context, input }) => {
    if (!(await ownsActiveTask(input.taskId, context.userId))) {
      throw new NotFoundError("Task not found");
    }
    return createTaskReminder({
      taskId: input.taskId,
      userId: context.userId,
      remindAt: new Date(input.remindAt),
      label: input.label,
    });
  }),

  removeReminder: os.removeReminder.handler(async ({ context, input }) => {
    const deleted = await deleteTaskReminder(input.id, context.userId);
    if (!deleted) throw new NotFoundError("Reminder not found");
    return { ok: true as const };
  }),
});
