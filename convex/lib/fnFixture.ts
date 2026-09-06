import { v } from 'convex/values';
import { kinoAction, kinoClosed, kinoMutation, kinoProposal, kinoQuery } from './fn';

// Sondas del envoltorio para `convex/fn.test.ts`. Devuelven lo mínimo y sólo a quien
// tiene sesión; existen para que el test llame a una función real de cada clase.

export const read = kinoQuery({
  args: {},
  handler: async (ctx) => ({ userId: ctx.user._id, scope: ctx.scope }),
});

export const write = kinoMutation({
  args: {},
  handler: async (ctx) => ({ userId: ctx.user._id, scope: ctx.scope }),
});

export const propose = kinoProposal({
  args: {},
  handler: async (ctx) => ({ userId: ctx.user._id, scope: ctx.scope }),
});

export const close = kinoClosed({
  args: {},
  handler: async (ctx) => ({ userId: ctx.user._id, scope: ctx.scope, channel: ctx.channel }),
});

export const actClosed = kinoAction(50, 'closed')({
  args: {},
  handler: async (ctx) => ({ userId: ctx.user._id, channel: ctx.channel }),
});

export const act = kinoAction(50)({
  args: { waitMs: v.optional(v.number()) },
  handler: async (ctx, { waitMs }) => {
    if (waitMs) await new Promise((resolve) => setTimeout(resolve, waitMs));
    return { userId: ctx.user._id, remainingMs: ctx.budget.remainingMs() };
  },
});
