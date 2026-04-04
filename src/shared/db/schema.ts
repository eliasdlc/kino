// src/shared/db/schema.ts


import {
  AnyPgColumn,
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  smallint,
  timestamp,
  date,
  time,
  pgEnum,
  uniqueIndex,
  index,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { customType } from 'drizzle-orm/pg-core';

// ============================================================================
// Custom Types
// ============================================================================

/**
 * PostgreSQL ltree extension type.
 * Drizzle has no native ltree support — we define it as a customType.
 * Queries using ltree operators (<@, @>, ~, etc.) must use sql`` escape hatch.
 */
const ltree = customType<{ data: string }>({
  dataType() {
    return 'ltree';
  },
});

// ============================================================================
// Enumerations (ENUMs)
// ============================================================================

export const authProviderEnum = pgEnum('auth_provider', [
  'local',
  'google',
  'github',
]);

export const profileTypeEnum = pgEnum('profile_type', [
  'student',
  'freelancer',
  'corporate',
]);

export const templateTypeEnum = pgEnum('template_type', [
  'academic',
  'professional',
  'entrepreneurial',
  'personal',
  'custom',
  'inbox',
]);

export const energyLevelEnum = pgEnum('energy_level', [
  'high',
  'medium',
  'low',
]);

export const taskStatusEnum = pgEnum('task_status', [
  'backlog',
  'week',
  'today',
  'done',
  'archived',
]);

export const taskPriorityEnum = pgEnum('task_priority', [
  'critical',
  'high',
  'medium',
  'low',
]);

export const weekdayEnum = pgEnum('weekday', [
  'mon',
  'tue',
  'wed',
  'thu',
  'fri',
  'sat',
  'sun',
]);

export const uiThemeEnum = pgEnum('ui_theme', ['dark', 'light', 'system']);

export const timeSourceEnum = pgEnum('time_source', [
  'pomodoro',
  'manual',
  'timer',
]);

export const questTypeEnum = pgEnum('quest_type', [
  'consistency',
  'milestone',
  'recovery',
]);

export const questFrequencyEnum = pgEnum('quest_frequency', [
  'daily',
  'weekly',
  'monthly',
]);

export const itemTypeEnum = pgEnum('item_type', [
  'freeze',
  'theme',
  'sticker',
  'boost',
]);

export const accountStatusEnum = pgEnum('account_status', [
  'active',
  'banned',
]);

export const syncProviderEnum = pgEnum('sync_provider', [
  'google_calendar',
  'jira',
  'slack',
  'microsoft_teams',
  'notion',
  'ical',
]);

export const colorEnum = pgEnum('color', [
  'red',
  'blue',
  'pink',
  'purple',
  'green',
  'orange',
  'yellow',
  'teal',
  'gray',
  'black',
  'white',
]);

// ============================================================================
// Tables
// ============================================================================

// ── users ──

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: varchar('email', { length: 255 }).notNull().unique(),
    emailVerified: boolean('email_verified').notNull().default(false),
    name: varchar('name', { length: 100 }).notNull(),
    image: text('image'),
    provider: authProviderEnum('provider').notNull().default('local'),
    providerId: varchar('provider_id', { length: 255 }),
    onboardingCompleted: boolean('onboarding_completed')
      .notNull()
      .default(false),
    xpTotal: integer('xp_total').notNull().default(0),
    coins: integer('coins').notNull().default(0),
    status: accountStatusEnum('status').notNull().default('active'),
    timezone: varchar('timezone', { length: 50 })
      .notNull()
      .default('America/Santo_Domingo'),
    lastSyncDate: timestamp('last_sync_date', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('idx_users_provider')
      .on(table.provider, table.providerId)
      .where(sql`${table.providerId} IS NOT NULL`),
  ],
);

// ── user_settings ──

export const userSettings = pgTable('user_settings', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  profileType: profileTypeEnum('profile_type'),
  onboardingVersion: integer('onboarding_version').notNull().default(1),
  peakEnergyStart: time('peak_energy_start'),
  peakEnergyEnd: time('peak_energy_end'),
  weeklyReviewDay: weekdayEnum('weekly_review_day').notNull().default('sun'),
  brainDumpDefaultSystem: uuid('brain_dump_default_system'),
  dailyResetTime: time('daily_reset_time').notNull().default('00:00'),
  dailyEnergyLimit: smallint('daily_energy_limit').notNull().default(50),
  focusTimeoutHours: smallint('focus_timeout_hours').notNull().default(3),
  theme: uiThemeEnum('theme').notNull().default('system'),
  notificationsEnabled: boolean('notifications_enabled')
    .notNull()
    .default(true),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// NOTE: FK user_settings.brain_dump_default_system → systems.id
// is deferred (added after systems table exists).
// Drizzle does not support ALTER TABLE ADD CONSTRAINT declaratively.
// Apply via raw migration:
//   ALTER TABLE user_settings ADD CONSTRAINT fk_settings_braindump
//     FOREIGN KEY (brain_dump_default_system) REFERENCES systems(id)
//     ON DELETE SET NULL;

// ── sessions (Better Auth) ──

export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    token: varchar('token', { length: 255 }).notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    ipAddress: varchar('ip_address', { length: 45 }),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('idx_sessions_token').on(table.token),
    index('idx_sessions_user').on(table.userId),
  ],
);

// ── accounts (Better Auth) ──
// Stores OAuth provider credentials and email/password credential references.
// Better Auth manages this table — do not manually insert rows.

export const accounts = pgTable(
  'accounts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    accountId: varchar('account_id', { length: 255 }).notNull(),
    providerId: varchar('provider_id', { length: 255 }).notNull(),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at', {
      withTimezone: true,
    }),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at', {
      withTimezone: true,
    }),
    scope: varchar('scope', { length: 500 }),
    password: varchar('password', { length: 255 }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('idx_accounts_user').on(table.userId),
    index('idx_accounts_provider').on(table.providerId, table.accountId),
  ],
);

// ── verifications (Better Auth) ──
// Stores email verification tokens and password reset tokens.
// Better Auth manages this table — do not manually insert rows.

export const verifications = pgTable(
  'verifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    identifier: varchar('identifier', { length: 255 }).notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('idx_verifications_identifier').on(table.identifier),
  ],
);

// ── systems ──

export const systems = pgTable(
  'systems',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    color: colorEnum('color').notNull().default('blue'),
    identityStatement: varchar('identity_statement', { length: 500 }),
    templateType: templateTypeEnum('template_type')
      .notNull()
      .default('custom'),
    energyIdeal: energyLevelEnum('energy_ideal'),
    icon: varchar('icon', { length: 50 }).notNull().default('folder'),
    isActive: boolean('is_active').notNull().default(true),
    isInbox: boolean('is_inbox').notNull().default(false),
    expectedFrequency: varchar('expected_frequency', { length: 20 }),
    triggerContext: varchar('trigger_context', { length: 255 }),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // Exactly one Inbox per user
    uniqueIndex('one_inbox_per_user')
      .on(table.userId)
      .where(sql`${table.isInbox} = true`),
    index('idx_systems_user').on(table.userId, table.isActive),
    index('idx_systems_sort').on(table.userId, table.sortOrder),
  ],
);

// ── context_tags ──

export const contextTags = pgTable(
  'context_tags',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 24 }).notNull(),
    color: colorEnum('color').notNull().default('blue'),
    isDefault: boolean('is_default').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index('idx_tags_user').on(table.userId)],
);

// ── tasks ──

export const tasks = pgTable(
  'tasks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    systemId: uuid('system_id')
      .notNull()
      .references(() => systems.id, { onDelete: 'cascade' }),
    parentTaskId: uuid('parent_task_id').references((): AnyPgColumn => tasks.id, {
      onDelete: 'cascade',
    }),
    title: varchar('title', { length: 500 }).notNull(),
    description: text('description'),
    status: taskStatusEnum('status').notNull().default('backlog'),
    energyLevel: energyLevelEnum('energy_level').notNull().default('medium'),
    energyPoints: smallint('energy_points').notNull().default(3),
    priority: taskPriorityEnum('priority').notNull().default('medium'),
    taskType: varchar('task_type', { length: 100 }),
    dueDate: date('due_date'),
    scheduledDate: date('scheduled_date'),
    estimatedMinutes: integer('estimated_minutes'),
    isRecurring: boolean('is_recurring').notNull().default(false),
    recurrenceRule: varchar('recurrence_rule', { length: 500 }),
    recurrenceParentId: uuid('recurrence_parent_id').references(
      (): AnyPgColumn => tasks.id,
      { onDelete: 'set null' },
    ),
    contextTagId: uuid('context_tag_id').references(() => contextTags.id, {
      onDelete: 'set null',
    }),
    externalSource: varchar('external_source', { length: 255 }),
    sortIndex: integer('sort_index').notNull().default(0),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      'energy_points_range',
      sql`${table.energyPoints} BETWEEN 1 AND 10`,
    ),
    check(
      'estimated_minutes_positive',
      sql`${table.estimatedMinutes} > 0`,
    ),
    index('idx_tasks_user_status')
      .on(table.userId, table.status)
      .where(sql`${table.deletedAt} IS NULL`),
    index('idx_tasks_system')
      .on(table.systemId, table.status)
      .where(sql`${table.deletedAt} IS NULL`),
    index('idx_tasks_due')
      .on(table.userId, table.dueDate)
      .where(
        sql`${table.deletedAt} IS NULL AND ${table.dueDate} IS NOT NULL`,
      ),
    index('idx_tasks_recurring')
      .on(table.userId)
      .where(
        sql`${table.isRecurring} = true AND ${table.deletedAt} IS NULL`,
      ),
    index('idx_tasks_parent')
      .on(table.parentTaskId)
      .where(sql`${table.parentTaskId} IS NOT NULL`),
  ],
);

// ── folders (ltree) ──

export const folders = pgTable(
  'folders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    systemId: uuid('system_id').references(() => systems.id, {
      onDelete: 'set null',
    }),
    parentId: uuid('parent_id').references((): AnyPgColumn => folders.id, {
      onDelete: 'cascade',
    }),
    name: varchar('name', { length: 255 }).notNull(),
    color: colorEnum('color').notNull().default('blue'),
    path: ltree('path').notNull(),
    sortIndex: integer('sort_index').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // GiST index for ltree — must be applied via raw migration:
    //   CREATE INDEX idx_folders_path ON folders USING GIST (path);
    // Drizzle does not support USING GIST on custom types declaratively.
    index('idx_folders_user').on(table.userId),
    index('idx_folders_parent').on(table.parentId),
  ],
);

// ── pages ──

export const pages = pgTable(
  'pages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    folderId: uuid('folder_id').references(() => folders.id, {
      onDelete: 'set null',
    }),
    systemId: uuid('system_id').references(() => systems.id, {
      onDelete: 'set null',
    }),
    title: varchar('title', { length: 500 }),
    content: text('content'),
    isPinned: boolean('is_pinned').notNull().default(false),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('idx_pages_user')
      .on(table.userId)
      .where(sql`${table.deletedAt} IS NULL`),
    index('idx_pages_folder')
      .on(table.folderId)
      .where(sql`${table.folderId} IS NOT NULL`),
    index('idx_pages_system')
      .on(table.systemId)
      .where(sql`${table.systemId} IS NOT NULL`),
  ],
);

// ── sticky_notes ──

export const stickyNotes = pgTable(
  'sticky_notes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    pageId: uuid('page_id').references(() => pages.id, {
      onDelete: 'cascade',
    }),
    folderId: uuid('folder_id').references(() => folders.id, {
      onDelete: 'cascade',
    }),
    title: varchar('title', { length: 200 }),
    content: varchar('content', { length: 500 }),
    color: colorEnum('color').notNull().default('yellow'),
    sortIndex: integer('sort_index').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // XOR constraint: page_id OR folder_id, never both, never neither
    check(
      'sticky_note_location',
      sql`(${table.pageId} IS NOT NULL AND ${table.folderId} IS NULL) OR (${table.pageId} IS NULL AND ${table.folderId} IS NOT NULL)`,
    ),
    index('idx_sticky_user').on(table.userId),
    index('idx_sticky_page')
      .on(table.pageId)
      .where(sql`${table.pageId} IS NOT NULL`),
    index('idx_sticky_folder')
      .on(table.folderId)
      .where(sql`${table.folderId} IS NOT NULL`),
  ],
);

// ── time_logs ──

export const timeLogs = pgTable(
  'time_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    taskId: uuid('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    systemId: uuid('system_id')
      .notNull()
      .references(() => systems.id, { onDelete: 'cascade' }),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    endedAt: timestamp('ended_at', { withTimezone: true }),
    durationMinutes: integer('duration_minutes').notNull(),
    source: timeSourceEnum('source').notNull().default('timer'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      'duration_minutes_non_negative',
      sql`${table.durationMinutes} >= 0`,
    ),
    index('idx_timelogs_user').on(table.userId, table.startedAt),
    index('idx_timelogs_system').on(table.systemId, table.startedAt),
  ],
);

// ── system_health ──

export const systemHealth = pgTable(
  'system_health',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    systemId: uuid('system_id')
      .notNull()
      .references(() => systems.id, { onDelete: 'cascade' }),
    date: date('date').notNull(),
    wasActive: boolean('was_active').notNull().default(false),
    tasksCompleted: integer('tasks_completed').notNull().default(0),
    minutesLogged: integer('minutes_logged').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('uq_system_health_day').on(table.systemId, table.date),
    index('idx_health_user').on(table.userId, table.date),
  ],
);

// ── energy_logs ──

export const energyLogs = pgTable(
  'energy_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    energyValue: smallint('energy_value').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      'energy_value_range',
      sql`${table.energyValue} BETWEEN 1 AND 100`,
    ),
    index('idx_energy_user').on(table.userId, table.createdAt),
  ],
);

// ── quests ──

export const quests = pgTable(
  'quests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    systemId: uuid('system_id').references(() => systems.id, {
      onDelete: 'set null',
    }),
    title: varchar('title', { length: 255 }).notNull(),
    description: text('description').notNull(),
    questType: questTypeEnum('quest_type').notNull(),
    frequency: questFrequencyEnum('frequency').notNull().default('daily'),
    targetValue: integer('target_value').notNull(),
    currentValue: integer('current_value').notNull().default(0),
    expiresAt: date('expires_at').notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    rewardXp: integer('reward_xp').notNull(),
    rewardCoins: integer('reward_coins').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index('idx_quests_user').on(table.userId, table.expiresAt)],
);

// ── inventory_items ──

export const inventoryItems = pgTable(
  'inventory_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    itemType: itemTypeEnum('item_type').notNull(),
    itemKey: varchar('item_key', { length: 100 }).notNull(),
    quantity: integer('quantity').notNull().default(1),
    coinCost: integer('coin_cost').notNull(),
    acquiredAt: timestamp('acquired_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index('idx_inventory_user').on(table.userId)],
);

// ── sync_connections ──

export const syncConnections = pgTable(
  'sync_connections',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    provider: syncProviderEnum('provider').notNull(),
    accessTokenEncrypted: text('access_token_encrypted').notNull(),
    refreshTokenEncrypted: text('refresh_token_encrypted'),
    feedUrl: text('feed_url'),
    lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('uq_sync_user_provider').on(table.userId, table.provider),
  ],
);

// ── push_subscriptions ──

export const pushSubscriptions = pgTable(
  'push_subscriptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    endpoint: text('endpoint').notNull().unique(),
    authKey: text('auth_key').notNull(),
    p256dhKey: text('p256dh_key').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index('idx_push_user').on(table.userId)],
);

// ── default_context_tags (seed/reference table) ──

export const defaultContextTags = pgTable('default_context_tags', {
  id: uuid('id').primaryKey().defaultRandom(),
  profileType: profileTypeEnum('profile_type').notNull(),
  title: varchar('title', { length: 24 }).notNull(),
  color: colorEnum('color').notNull().default('blue'),
});
