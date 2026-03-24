import { pgTable, uuid, varchar, text, boolean, integer, smallint, timestamp, date, time, pgEnum, uniqueIndex, index } from 'drizzle-orm/pg-core';

export const users = pgTable("users", {
    id: uuid('id').primaryKey().defaultRandom(),
    email: varchar('email', { length: 255 }).notNull().unique(),
    createdAt: timestamp('last_sync_date', { withTimezone: true }).notNull().defaultNow(),
});