import {
  pgTable,
  text,
  timestamp,
  boolean,
  pgEnum,
  integer,
  varchar,
  unique,
  index,
  primaryKey,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import type { AdapterAccount } from "@auth/core/adapters";

// Enums
export const userRoleEnum = pgEnum("user_role", ["admin", "translator", "reviewer"]);
export const translationStateEnum = pgEnum("translation_state", [
  "draft",
  "review",
  "approved",
]);
export const aiProviderEnum = pgEnum("ai_provider", [
  "openai",
  "gemini",
  "google-translate",
]);
export const projectMemberRoleEnum = pgEnum("project_member_role", [
  "translator",
  "reviewer",
]);
export const translationQueueStatusEnum = pgEnum("translation_queue_status", [
  "pending",
  "processing",
  "completed",
  "failed",
]);
export const notificationTypeEnum = pgEnum("notification_type", [
  "review_request",
  "translation_approved",
  "translation_rejected",
  "queue_completed",
  "comment_mention",
  "translation_updated",
]);
export const webhookEventTypeEnum = pgEnum("webhook_event_type", [
  "translation.created",
  "translation.updated",
  "translation.approved",
  "translation.rejected",
  "key.created",
  "key.deleted",
  "queue.completed",
  "queue.failed",
]);
export const webhookStatusEnum = pgEnum("webhook_status", [
  "active",
  "paused",
  "disabled",
]);
export const organizationMemberRoleEnum = pgEnum("organization_member_role", [
  "owner",
  "admin",
  "member",
]);
export const emailProviderEnum = pgEnum("email_provider", [
  "smtp",
  "resend",
  "sendgrid",
  "ses",
]);
export const integrationTypeEnum = pgEnum("integration_type", [
  "slack",
  "teams",
  "discord",
]);

// Organizations table (multi-tenant support)
export const organizations = pgTable("organizations", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(), // URL-friendly identifier
  domain: text("domain"), // Primary domain for email-based auto-join
  logoUrl: text("logo_url"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  slugIdx: index("organizations_slug_idx").on(t.slug),
  domainIdx: index("organizations_domain_idx").on(t.domain),
}));

// Organization members (users belong to organizations)
export const organizationMembers = pgTable("organization_members", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  role: organizationMemberRoleEnum("role").notNull().default("member"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  pk: unique().on(t.organizationId, t.userId),
  orgIdx: index("org_members_org_idx").on(t.organizationId),
  userIdx: index("org_members_user_idx").on(t.userId),
}));

// Organization settings (email, AI, auth configuration)
export const organizationSettings = pgTable("organization_settings", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" })
    .unique(),
  // Email configuration
  emailProvider: emailProviderEnum("email_provider"),
  emailFrom: text("email_from"), // From address
  emailFromName: text("email_from_name"), // From name
  smtpHost: text("smtp_host"),
  smtpPort: integer("smtp_port"),
  smtpUser: text("smtp_user"),
  smtpPassword: text("smtp_password"), // Encrypted
  smtpSecure: boolean("smtp_secure").default(true),
  resendApiKey: text("resend_api_key"), // Encrypted
  sendgridApiKey: text("sendgrid_api_key"), // Encrypted
  sesAccessKeyId: text("ses_access_key_id"), // Encrypted
  sesSecretAccessKey: text("ses_secret_access_key"), // Encrypted
  sesRegion: text("ses_region"),
  // AI Provider configuration
  openaiApiKey: text("openai_api_key"), // Encrypted
  geminiApiKey: text("gemini_api_key"), // Encrypted
  googleTranslateApiKey: text("google_translate_api_key"), // Encrypted
  // Authentication configuration
  allowedEmailDomains: text("allowed_email_domains"), // Comma-separated
  googleClientId: text("google_client_id"), // Encrypted
  googleClientSecret: text("google_client_secret"), // Encrypted
  // Feature flags
  emailNotificationsEnabled: boolean("email_notifications_enabled").default(true),
  aiTranslationEnabled: boolean("ai_translation_enabled").default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  orgIdx: index("org_settings_org_idx").on(t.organizationId),
}));

// NextAuth tables
export const users = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),
  role: userRoleEnum("role").notNull().default("translator"),
  organizationId: text("organization_id") // User's primary organization
    .references(() => organizations.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const accounts = pgTable(
  "account",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccount["type"]>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => ({
    compositePk: primaryKey({
      columns: [account.provider, account.providerAccountId],
    }),
  })
);

export const sessions = pgTable("session", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verificationToken",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (verificationToken) => ({
    compositePk: primaryKey({
      columns: [verificationToken.identifier, verificationToken.token],
    }),
  })
);

// Languages table
export const languages = pgTable("languages", {
  id: text("id").primaryKey(),
  code: varchar("code", { length: 10 }).notNull().unique(),
  name: text("name").notNull(),
  flagEmoji: text("flag_emoji"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Projects table (now belongs to an organization)
export const projects = pgTable("projects", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  defaultLanguageId: text("default_language_id").references(() => languages.id),
  apiKey: text("api_key").notNull().unique(),
  apiKeyHash: text("api_key_hash").notNull(),
  requiresReview: boolean("requires_review").notNull().default(true),
  aiProvider: aiProviderEnum("ai_provider"),
  aiFallbackProvider: aiProviderEnum("ai_fallback_provider"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  orgIdx: index("projects_org_idx").on(t.organizationId),
}));

// Project languages (many-to-many)
export const projectLanguages = pgTable(
  "project_languages",
  {
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    languageId: text("language_id")
      .notNull()
      .references(() => languages.id, { onDelete: "cascade" }),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    pk: unique().on(t.projectId, t.languageId),
  })
);

// Translation keys
export const translationKeys = pgTable(
  "translation_keys",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    description: text("description"),
    namespace: text("namespace"),
    deprecated: boolean("deprecated").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    projectKeyIdx: unique().on(t.projectId, t.key),
    projectIdx: index("translation_keys_project_idx").on(t.projectId),
  })
);

// Key screenshots
export const keyScreenshots = pgTable("key_screenshots", {
  id: text("id").primaryKey(),
  keyId: text("key_id")
    .notNull()
    .references(() => translationKeys.id, { onDelete: "cascade" }),
  imageUrl: text("image_url").notNull(),
  altText: text("alt_text"),
  uploadedBy: text("uploaded_by")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Translations
export const translations = pgTable(
  "translations",
  {
    id: text("id").primaryKey(),
    keyId: text("key_id")
      .notNull()
      .references(() => translationKeys.id, { onDelete: "cascade" }),
    languageId: text("language_id")
      .notNull()
      .references(() => languages.id, { onDelete: "cascade" }),
    value: text("value").notNull(),
    state: translationStateEnum("state").notNull().default("draft"),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id),
    reviewedBy: text("reviewed_by").references(() => users.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    keyLanguageIdx: unique().on(t.keyId, t.languageId),
    keyIdx: index("translations_key_idx").on(t.keyId),
    languageIdx: index("translations_language_idx").on(t.languageId),
  })
);

// Translation history
export const translationHistory = pgTable("translation_history", {
  id: text("id").primaryKey(),
  translationId: text("translation_id")
    .notNull()
    .references(() => translations.id, { onDelete: "cascade" }),
  value: text("value").notNull(),
  state: translationStateEnum("state").notNull(),
  changedBy: text("changed_by")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Translation memory
export const translationMemory = pgTable("translation_memory", {
  id: text("id").primaryKey(),
  sourceLanguageId: text("source_language_id")
    .notNull()
    .references(() => languages.id),
  targetLanguageId: text("target_language_id")
    .notNull()
    .references(() => languages.id),
  sourceText: text("source_text").notNull(),
  targetText: text("target_text").notNull(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  usageCount: integer("usage_count").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Comments
export const comments = pgTable("comments", {
  id: text("id").primaryKey(),
  translationId: text("translation_id")
    .notNull()
    .references(() => translations.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Project members
export const projectMembers = pgTable(
  "project_members",
  {
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: projectMemberRoleEnum("role").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    pk: unique().on(t.projectId, t.userId),
  })
);

// Translation queue for bulk AI translation
export const translationQueue = pgTable("translation_queue", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  keyId: text("key_id")
    .notNull()
    .references(() => translationKeys.id, { onDelete: "cascade" }),
  translationId: text("translation_id").references(() => translations.id, { onDelete: "cascade" }),
  sourceLanguageId: text("source_language_id")
    .notNull()
    .references(() => languages.id),
  targetLanguageId: text("target_language_id")
    .notNull()
    .references(() => languages.id),
  sourceText: text("source_text").notNull(),
  imageUrl: text("image_url"),
  status: translationQueueStatusEnum("status").notNull().default("pending"),
  translatedText: text("translated_text"),
  error: text("error"),
  provider: aiProviderEnum("provider"),
  createdBy: text("created_by")
    .notNull()
    .references(() => users.id),
  processedAt: timestamp("processed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  projectIdx: index("translation_queue_project_idx").on(t.projectId),
  statusIdx: index("translation_queue_status_idx").on(t.status),
}));

// Notifications
export const notifications = pgTable("notifications", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  type: notificationTypeEnum("type").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  link: text("link"),
  read: boolean("read").notNull().default(false),
  metadata: text("metadata"), // JSON string for additional data
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  userIdx: index("notifications_user_idx").on(t.userId),
  readIdx: index("notifications_read_idx").on(t.read),
  createdAtIdx: index("notifications_created_at_idx").on(t.createdAt),
}));

// CLI Tokens for CLI tool authentication
export const cliTokens = pgTable("cli_tokens", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  tokenIdx: index("cli_tokens_token_idx").on(t.token),
  userIdx: index("cli_tokens_user_idx").on(t.userId),
}));

// Saved searches
export const savedSearches = pgTable("saved_searches", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  query: text("query").notNull(), // Search query string
  filters: text("filters"), // JSON string for filters (lang, namespace, state, etc.)
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  userIdx: index("saved_searches_user_idx").on(t.userId),
  projectIdx: index("saved_searches_project_idx").on(t.projectId),
}));

// Search history (recent searches)
export const searchHistory = pgTable("search_history", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  query: text("query").notNull(),
  filters: text("filters"), // JSON string for filters
  resultCount: integer("result_count").default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  userIdx: index("search_history_user_idx").on(t.userId),
  projectIdx: index("search_history_project_idx").on(t.projectId),
  createdAtIdx: index("search_history_created_at_idx").on(t.createdAt),
}));

// Webhooks table
export const webhooks = pgTable("webhooks", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  secret: text("secret").notNull(), // For signing webhook payloads
  events: text("events").notNull(), // JSON array of event types
  status: webhookStatusEnum("status").notNull().default("active"),
  description: text("description"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  lastTriggeredAt: timestamp("last_triggered_at"),
  failureCount: integer("failure_count").default(0),
}, (t) => ({
  projectIdx: index("webhooks_project_idx").on(t.projectId),
  statusIdx: index("webhooks_status_idx").on(t.status),
}));

// Webhook delivery logs (for debugging and retry logic)
export const webhookDeliveries = pgTable("webhook_deliveries", {
  id: text("id").primaryKey(),
  webhookId: text("webhook_id")
    .notNull()
    .references(() => webhooks.id, { onDelete: "cascade" }),
  eventType: webhookEventTypeEnum("event_type").notNull(),
  payload: text("payload").notNull(), // JSON payload
  status: text("status").notNull(), // "pending", "success", "failed"
  statusCode: integer("status_code"),
  responseBody: text("response_body"),
  errorMessage: text("error_message"),
  attemptNumber: integer("attempt_number").default(1),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  deliveredAt: timestamp("delivered_at"),
}, (t) => ({
  webhookIdx: index("webhook_deliveries_webhook_idx").on(t.webhookId),
  statusIdx: index("webhook_deliveries_status_idx").on(t.status),
  createdAtIdx: index("webhook_deliveries_created_at_idx").on(t.createdAt),
}));

// Communication integrations (Slack, Teams, Discord)
export const integrations = pgTable("integrations", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  type: integrationTypeEnum("type").notNull(),
  name: text("name").notNull(), // User-friendly name
  // Slack-specific fields
  slackWorkspaceId: text("slack_workspace_id"),
  slackTeamId: text("slack_team_id"),
  slackChannelId: text("slack_channel_id"),
  slackChannelName: text("slack_channel_name"),
  slackAccessToken: text("slack_access_token"), // Encrypted
  slackBotToken: text("slack_bot_token"), // Encrypted
  slackWebhookUrl: text("slack_webhook_url"), // For incoming webhooks
  // Teams-specific fields
  teamsWebhookUrl: text("teams_webhook_url"),
  // Discord-specific fields
  discordWebhookUrl: text("discord_webhook_url"),
  // Common fields
  enabled: boolean("enabled").notNull().default(true),
  events: text("events").notNull(), // JSON array of event types (same as webhooks)
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  orgIdx: index("integrations_org_idx").on(t.organizationId),
  typeIdx: index("integrations_type_idx").on(t.type),
  enabledIdx: index("integrations_enabled_idx").on(t.enabled),
}));

// Relations
export const organizationsRelations = relations(organizations, ({ many, one }) => ({
  members: many(organizationMembers),
  projects: many(projects),
  settings: one(organizationSettings, {
    fields: [organizations.id],
    references: [organizationSettings.organizationId],
  }),
}));

export const organizationMembersRelations = relations(organizationMembers, ({ one }) => ({
  organization: one(organizations, {
    fields: [organizationMembers.organizationId],
    references: [organizations.id],
  }),
  user: one(users, {
    fields: [organizationMembers.userId],
    references: [users.id],
  }),
}));

export const organizationSettingsRelations = relations(organizationSettings, ({ one }) => ({
  organization: one(organizations, {
    fields: [organizationSettings.organizationId],
    references: [organizations.id],
  }),
}));

export const usersRelations = relations(users, ({ many, one }) => ({
  translations: many(translations),
  reviewedTranslations: many(translations, { relationName: "reviewedBy" }),
  comments: many(comments),
  projectMemberships: many(projectMembers),
  organizationMemberships: many(organizationMembers),
  uploadedScreenshots: many(keyScreenshots),
  notifications: many(notifications),
  cliTokens: many(cliTokens),
  savedSearches: many(savedSearches),
  searchHistory: many(searchHistory),
  organization: one(organizations, {
    fields: [users.organizationId],
    references: [organizations.id],
  }),
}));

export const projectsRelations = relations(projects, ({ many, one }) => ({
  organization: one(organizations, {
    fields: [projects.organizationId],
    references: [organizations.id],
  }),
  languages: many(projectLanguages),
  defaultLanguage: one(languages, {
    fields: [projects.defaultLanguageId],
    references: [languages.id],
  }),
  translationKeys: many(translationKeys),
  translationMemory: many(translationMemory),
  members: many(projectMembers),
  savedSearches: many(savedSearches),
  searchHistory: many(searchHistory),
}));

export const languagesRelations = relations(languages, ({ many }) => ({
  projects: many(projectLanguages),
  translations: many(translations),
  translationMemorySource: many(translationMemory, { relationName: "sourceLanguage" }),
  translationMemoryTarget: many(translationMemory, { relationName: "targetLanguage" }),
}));

export const translationKeysRelations = relations(translationKeys, ({ one, many }) => ({
  project: one(projects, {
    fields: [translationKeys.projectId],
    references: [projects.id],
  }),
  translations: many(translations),
  screenshots: many(keyScreenshots),
}));

export const translationsRelations = relations(translations, ({ one, many }) => ({
  key: one(translationKeys, {
    fields: [translations.keyId],
    references: [translationKeys.id],
  }),
  language: one(languages, {
    fields: [translations.languageId],
    references: [languages.id],
  }),
  createdByUser: one(users, {
    fields: [translations.createdBy],
    references: [users.id],
  }),
  reviewedByUser: one(users, {
    fields: [translations.reviewedBy],
    references: [users.id],
    relationName: "reviewedBy",
  }),
  history: many(translationHistory),
  comments: many(comments),
}));

export const cliTokensRelations = relations(cliTokens, ({ one }) => ({
  user: one(users, {
    fields: [cliTokens.userId],
    references: [users.id],
  }),
}));

export const savedSearchesRelations = relations(savedSearches, ({ one }) => ({
  user: one(users, {
    fields: [savedSearches.userId],
    references: [users.id],
  }),
  project: one(projects, {
    fields: [savedSearches.projectId],
    references: [projects.id],
  }),
}));

export const searchHistoryRelations = relations(searchHistory, ({ one }) => ({
  user: one(users, {
    fields: [searchHistory.userId],
    references: [users.id],
  }),
  project: one(projects, {
    fields: [searchHistory.projectId],
    references: [projects.id],
  }),
}));

export const webhooksRelations = relations(webhooks, ({ one, many }) => ({
  project: one(projects, {
    fields: [webhooks.projectId],
    references: [projects.id],
  }),
  deliveries: many(webhookDeliveries),
}));

export const webhookDeliveriesRelations = relations(webhookDeliveries, ({ one }) => ({
  webhook: one(webhooks, {
    fields: [webhookDeliveries.webhookId],
    references: [webhooks.id],
  }),
}));

