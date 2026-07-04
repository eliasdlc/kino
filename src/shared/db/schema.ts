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
  real,
  doublePrecision,
  timestamp,
  date,
  time,
  jsonb,
  pgEnum,
  uniqueIndex,
  primaryKey,
  index,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { customType } from 'drizzle-orm/pg-core';
import type { SystemMetadata } from '@/shared/lib/system-types';

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
  'project',
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
  'tomorrow',
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

export const taskTypeEnum = pgEnum('task_type', [
  'task',
  'idea',
  'event',
  'reminder',
  // epic: tarea multi-paso que se descompone en subtasks (parent_task_id).
  'epic',
  // legacy values — kept for DB compat, no longer offered in UI
  'habit',
  'todo',
  'project',
]);

export const frequencyEnum = pgEnum('frequency', [
  'daily',
  'weekly',
  'monthly',
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
  // github: aún sin sincronización activa; sembrado para enchufar la integración
  // del systemType `project` sin re-migrar el enum (ver plan, sección GitHub-ready).
  'github',
]);

/** Estado de un sprint del systemType `project`. */
export const sprintStatusEnum = pgEnum('sprint_status', ['active', 'completed']);

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

export const reminderSourceEnum = pgEnum('reminder_source', ['auto', 'user']);

export const chronotypeEnum = pgEnum('chronotype', [
  'morning',
  'intermediate',
  'evening',
]);

export const sleepQualityEnum = pgEnum('sleep_quality', [
  'good',
  'partial',
  'poor',
]);

export const checkinSlotEnum = pgEnum('checkin_slot', [
  'morning',
  'afternoon',
  'evening',
]);

export const predictionAccuracyEnum = pgEnum('prediction_accuracy', [
  'accurate',
  'partial',
  'inaccurate',
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
    status: accountStatusEnum('status').notNull().default('active'),
    timezone: varchar('timezone', { length: 50 })
      .notNull()
      .default('America/Santo_Domingo'),
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
  weeklyReviewDay: weekdayEnum('weekly_review_day').notNull().default('sun'),
  dailyResetTime: time('daily_reset_time').notNull().default('00:00'),
  // Día (en tz del usuario) en que se hizo el último rollover del plan de hoy.
  // Lo usa ensureTodayPlanRolled para limpiar/repoblar in_today_plan una vez por día.
  todayPlanDate: date('today_plan_date'),
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

// ── jwks (Better Auth — jwt plugin) ──
// Signing keys for OAuth/OIDC access tokens. Better Auth manages this table.

export const jwks = pgTable('jwks', {
  id: uuid('id').primaryKey().defaultRandom(),
  publicKey: text('public_key').notNull(),
  privateKey: text('private_key').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
});

// ── oauth_clients (Better Auth — oauth-provider plugin) ──
// OAuth 2.1 clients (model "oauthClient"). Includes dynamically-registered
// public clients such as Claude's MCP connector. Better Auth manages this table.

export const oauthClients = pgTable(
  'oauth_clients',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clientId: varchar('client_id', { length: 255 }).notNull().unique(),
    clientSecret: text('client_secret'),
    disabled: boolean('disabled').default(false),
    skipConsent: boolean('skip_consent'),
    enableEndSession: boolean('enable_end_session'),
    subjectType: varchar('subject_type', { length: 50 }),
    scopes: jsonb('scopes'),
    userId: uuid('user_id').references(() => users.id, {
      onDelete: 'cascade',
    }),
    name: varchar('name', { length: 255 }),
    uri: text('uri'),
    icon: text('icon'),
    contacts: jsonb('contacts'),
    tos: text('tos'),
    policy: text('policy'),
    softwareId: varchar('software_id', { length: 255 }),
    softwareVersion: varchar('software_version', { length: 100 }),
    softwareStatement: text('software_statement'),
    redirectUris: jsonb('redirect_uris').notNull(),
    postLogoutRedirectUris: jsonb('post_logout_redirect_uris'),
    tokenEndpointAuthMethod: varchar('token_endpoint_auth_method', {
      length: 50,
    }),
    grantTypes: jsonb('grant_types'),
    responseTypes: jsonb('response_types'),
    public: boolean('public'),
    type: varchar('type', { length: 50 }),
    requirePKCE: boolean('require_pkce'),
    referenceId: varchar('reference_id', { length: 255 }),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index('idx_oauth_clients_user').on(table.userId)],
);

// ── oauth_refresh_tokens (Better Auth — oauth-provider plugin) ──

export const oauthRefreshTokens = pgTable(
  'oauth_refresh_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    token: text('token').notNull().unique(),
    clientId: varchar('client_id', { length: 255 })
      .notNull()
      .references(() => oauthClients.clientId, { onDelete: 'cascade' }),
    sessionId: uuid('session_id').references(() => sessions.id, {
      onDelete: 'set null',
    }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    referenceId: varchar('reference_id', { length: 255 }),
    scopes: jsonb('scopes').notNull(),
    authTime: timestamp('auth_time', { withTimezone: true }),
    revoked: timestamp('revoked', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('idx_oauth_refresh_client').on(table.clientId),
    index('idx_oauth_refresh_session').on(table.sessionId),
    index('idx_oauth_refresh_user').on(table.userId),
  ],
);

// ── oauth_access_tokens (Better Auth — oauth-provider plugin) ──

export const oauthAccessTokens = pgTable(
  'oauth_access_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    token: text('token').notNull().unique(),
    clientId: varchar('client_id', { length: 255 })
      .notNull()
      .references(() => oauthClients.clientId, { onDelete: 'cascade' }),
    sessionId: uuid('session_id').references(() => sessions.id, {
      onDelete: 'set null',
    }),
    userId: uuid('user_id').references(() => users.id, {
      onDelete: 'cascade',
    }),
    referenceId: varchar('reference_id', { length: 255 }),
    refreshId: uuid('refresh_id').references(() => oauthRefreshTokens.id, {
      onDelete: 'cascade',
    }),
    scopes: jsonb('scopes').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('idx_oauth_access_client').on(table.clientId),
    index('idx_oauth_access_session').on(table.sessionId),
    index('idx_oauth_access_user').on(table.userId),
    index('idx_oauth_access_refresh').on(table.refreshId),
  ],
);

// ── oauth_consents (Better Auth — oauth-provider plugin) ──

export const oauthConsents = pgTable(
  'oauth_consents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clientId: varchar('client_id', { length: 255 })
      .notNull()
      .references(() => oauthClients.clientId, { onDelete: 'cascade' }),
    userId: uuid('user_id').references(() => users.id, {
      onDelete: 'cascade',
    }),
    referenceId: varchar('reference_id', { length: 255 }),
    scopes: jsonb('scopes').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('idx_oauth_consents_client').on(table.clientId),
    index('idx_oauth_consents_user').on(table.userId),
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
    metadata: jsonb('metadata').$type<SystemMetadata | null>(),
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
    // null → tag global del usuario; con valor → tag específico de ese sistema.
    systemId: uuid('system_id').references(() => systems.id, {
      onDelete: 'cascade',
    }),
    title: varchar('title', { length: 24 }).notNull(),
    color: colorEnum('color').notNull().default('blue'),
    isDefault: boolean('is_default').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('idx_tags_user').on(table.userId),
    index('idx_tags_system').on(table.systemId),
  ],
);

// ── system_status_definitions ──
// Valid task statuses per system_type. Seeded with defaults; custom systems
// may add user-defined rows (Phase 4.5).

export const systemStatusDefinitions = pgTable(
  'system_status_definitions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    systemType: templateTypeEnum('system_type').notNull(),
    statusName: varchar('status_name', { length: 50 }).notNull(),
    label: varchar('label', { length: 100 }).notNull(),
    position: smallint('position').notNull(),
    emoji: varchar('emoji', { length: 10 }),
  },
  (table) => [
    uniqueIndex('uq_system_status').on(table.systemType, table.statusName),
    index('idx_system_status_type').on(table.systemType),
  ],
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
    status: varchar('status', { length: 50 }).notNull().default('today'),
    // Segundo eje (solo systemType `project`): columna del board kanban. null en
    // sistemas que no son project. Separado de `status` (scheduling) a propósito —
    // ver migración 0006 y el plan. La columna terminal sincroniza con status='done'.
    boardStatus: varchar('board_status', { length: 50 }),
    boardStatusChangedAt: timestamp('board_status_changed_at', {
      withTimezone: true,
    }),
    energyLevel: energyLevelEnum('energy_level').notNull().default('medium'),
    priority: taskPriorityEnum('priority').notNull().default('medium'),
    taskType: taskTypeEnum('task_type'),
    // Timestamp con hora (PLAN-07 fase 3): las entregas pueden tener hora.
    // mode:'string' → el cliente recibe/envía strings; parsear con parseDueDate.
    dueDate: timestamp('due_date', { withTimezone: true, mode: 'string' }),
    // timestamptz (mode:'string') igual que dueDate: la fecha de inicio puede
    // tener hora opcional. Parsear con parseDueDate; "sin hora" = medianoche local.
    startDate: timestamp('start_date', { withTimezone: true, mode: 'string' }),
    estimatedTime: time('estimated_time'),
    recurrenceRule: varchar('recurrence_rule', { length: 500 }),
    recurrenceParentId: uuid('recurrence_parent_id').references(
      (): AnyPgColumn => tasks.id,
      { onDelete: 'set null' },
    ),
    folderId: uuid('folder_id').references(() => folders.id, {
      onDelete: 'set null',
    }),
    contextTagId: uuid('context_tag_id').references(() => contextTags.id, {
      onDelete: 'set null',
    }),
    sprintId: uuid('sprint_id').references(() => sprints.id, {
      onDelete: 'set null',
    }),
    externalSource: varchar('external_source', { length: 255 }),
    // github-ready: id del recurso externo (ej. issue) para mapeo idempotente.
    externalId: varchar('external_id', { length: 255 }),
    sortIndex: integer('sort_index').notNull().default(0),
    metadata: jsonb('metadata').$type<Record<string, unknown> | null>(),
    inTodayPlan: boolean('in_today_plan').notNull().default(false),
    notifiedBeforeDay: boolean('notified_before_day').notNull().default(false),
    notifiedDueDay: boolean('notified_due_day').notNull().default(false),
    reminderCount: integer('reminder_count').notNull().default(0),
    lastRemindedAt: timestamp('last_reminded_at', { withTimezone: true }),
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
        sql`${table.recurrenceRule} IS NOT NULL AND ${table.deletedAt} IS NULL`,
      ),
    index('idx_tasks_parent')
      .on(table.parentTaskId)
      .where(sql`${table.parentTaskId} IS NOT NULL`),
    index('idx_tasks_folder')
      .on(table.folderId)
      .where(
        sql`${table.folderId} IS NOT NULL AND ${table.deletedAt} IS NULL`,
      ),
    index('idx_tasks_board')
      .on(table.systemId, table.boardStatus)
      .where(
        sql`${table.boardStatus} IS NOT NULL AND ${table.deletedAt} IS NULL`,
      ),
    index('idx_tasks_sprint')
      .on(table.sprintId)
      .where(sql`${table.sprintId} IS NOT NULL`),
    uniqueIndex('uq_tasks_external')
      .on(table.externalSource, table.externalId)
      .where(sql`${table.externalId} IS NOT NULL`),
  ],
);

// ── sprints ──
// Iteraciones time-boxed del systemType `project`. Una tarea se asocia a un sprint
// vía tasks.sprint_id. Al cerrarse (status='completed') el sprint se archiva y sus
// tarjetas quedan agrupadas bajo él en la vista de archivadas.

export const sprints = pgTable(
  'sprints',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    systemId: uuid('system_id')
      .notNull()
      .references(() => systems.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    goal: varchar('goal', { length: 500 }),
    startDate: timestamp('start_date', { withTimezone: true }),
    endDate: timestamp('end_date', { withTimezone: true }),
    status: sprintStatusEnum('status').notNull().default('active'),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    sortOrder: integer('sort_order').notNull().default(0),
    // github-ready: mapeo a milestone/iteration externo.
    externalId: varchar('external_id', { length: 255 }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('idx_sprints_system').on(table.systemId, table.status),
    index('idx_sprints_user').on(table.userId),
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
    parentPageId: uuid('parent_page_id').references((): AnyPgColumn => pages.id, {
      onDelete: 'cascade',
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
    index('idx_pages_parent')
      .on(table.parentPageId)
      .where(sql`${table.parentPageId} IS NOT NULL`),
  ],
);

// ── task_page_links ──
// Many-to-many: a task can reference N pages and a page can reference N tasks.

export const taskPageLinks = pgTable(
  'task_page_links',
  {
    taskId: uuid('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    pageId: uuid('page_id')
      .notNull()
      .references(() => pages.id, { onDelete: 'cascade' }),
  },
  (table) => [
    primaryKey({ columns: [table.taskId, table.pageId] }),
    index('idx_task_page_links_task').on(table.taskId),
    index('idx_task_page_links_page').on(table.pageId),
  ],
);

// ── page_tags ──
// Many-to-many: a notebook can have multiple context_tags.

export const pageTags = pgTable(
  'page_tags',
  {
    pageId: uuid('page_id')
      .notNull()
      .references(() => pages.id, { onDelete: 'cascade' }),
    tagId: uuid('tag_id')
      .notNull()
      .references(() => contextTags.id, { onDelete: 'cascade' }),
  },
  (table) => [
    primaryKey({ columns: [table.pageId, table.tagId] }),
    index('idx_page_tags_page').on(table.pageId),
    index('idx_page_tags_tag').on(table.tagId),
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
    // Margin positioning: 'left' | 'right' | null (null = inline grid)
    positionSide: varchar('position_side', { length: 10 }),
    // Vertical position as fraction [0,1] of content height (null = unpositioned)
    positionY: real('position_y'),
    // Horizontal offset as fraction [0,1] of gutter width
    positionX: real('position_x'),
    // ProseMirror anchor mark id; non-null = anchored to text, null = free
    anchorId: varchar('anchor_id', { length: 36 }),
    // Stack grouping: all notes with same stackId form a visual stack
    stackId: uuid('stack_id'),
    // Excerpt of text selected when note was created from editor selection
    textAnchor: text('text_anchor'),
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

// ── task_reminders ──

export const taskReminders = pgTable(
  'task_reminders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    taskId: uuid('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    remindAt: timestamp('remind_at', { withTimezone: true }).notNull(),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    label: varchar('label', { length: 255 }),
    source: reminderSourceEnum('source').notNull().default('user'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_task_reminders_pending')
      .on(table.remindAt)
      .where(sql`${table.sentAt} IS NULL`),
    index('idx_task_reminders_task').on(table.taskId),
    index('idx_task_reminders_user').on(table.userId),
  ],
);

// ── default_context_tags (seed/reference table) ──

export const defaultContextTags = pgTable('default_context_tags', {
  id: uuid('id').primaryKey().defaultRandom(),
  profileType: profileTypeEnum('profile_type').notNull(),
  title: varchar('title', { length: 24 }).notNull(),
  color: colorEnum('color').notNull().default('blue'),
});

// ── user_energy_profile ──

export const userEnergyProfile = pgTable('user_energy_profile', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  chronotype: chronotypeEnum('chronotype').notNull().default('intermediate'),
  sleepTypicalHours: smallint('sleep_typical_hours').notNull().default(7),
  availableHoursPerDay: smallint('available_hours_per_day').notNull().default(8),
  energyFloor: smallint('energy_floor').notNull().default(20),
  rechargePresets: text('recharge_presets').notNull().default('[]'),
  learnedCurve: text('learned_curve').notNull().default('[]'),
  learningAlpha: doublePrecision('learning_alpha').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ── energy_checkins ──

export const energyCheckins = pgTable(
  'energy_checkins',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    date: date('date').notNull(),
    slot: checkinSlotEnum('slot').notNull().default('morning'),
    currentLevel: smallint('current_level').notNull(),
    sleepQuality: sleepQualityEnum('sleep_quality').notNull(),
    predictionAccuracy: predictionAccuracyEnum('prediction_accuracy'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      'checkin_level_range',
      sql`${table.currentLevel} BETWEEN 1 AND 100`,
    ),
    uniqueIndex('uq_checkin_slot').on(table.userId, table.date, table.slot),
    index('idx_checkin_user').on(table.userId, table.date),
  ],
);

// ── behavior_snapshots ──

export const behaviorSnapshots = pgTable(
  'behavior_snapshots',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    date: date('date').notNull(),
    tasksCreated: smallint('tasks_created').notNull().default(0),
    tasksCompleted: smallint('tasks_completed').notNull().default(0),
    tasksOverdue: smallint('tasks_overdue').notNull().default(0),
    criticalCount: smallint('critical_count').notNull().default(0),
    activeCount: smallint('active_count').notNull().default(0),
    completionRate: doublePrecision('completion_rate').notNull().default(0),
    // Alpha de personalización vigente al cerrar el día → histórico para la tendencia.
    learningAlpha: doublePrecision('learning_alpha').notNull().default(0),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('uq_snapshot_user_date').on(table.userId, table.date),
    index('idx_snapshot_user').on(table.userId, table.date),
  ],
);

// api_keys

export const api_keys = pgTable(
  'api_keys',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 100 }).notNull(),
    keyHash: varchar('key_hash', { length: 64 }).notNull().unique(),
    keyPrefix: varchar('key_prefix', { length: 14 }).notNull(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_api_keys_user').on(table.userId),
    index('idx_api_keys_hash').on(table.keyHash),
  ],
);
